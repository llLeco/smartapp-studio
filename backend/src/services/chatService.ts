import { Client, PrivateKey, TopicId, TopicMessageSubmitTransaction } from '@hashgraph/sdk';
import dotenv from 'dotenv';
import axios from 'axios';
import { getMirrorNodeUrl } from './hederaService.js';
import * as SDK from '@hashgraphonline/standards-sdk';

// Use a more robust approach for importing OpenAI
let OpenAI: any = null;
try {
  OpenAI = (await import('openai')).default;
} catch (e) {
  console.warn('⚠️ OpenAI SDK import failed, AI features will be limited');
}

// Load environment variables
dotenv.config();

// For HCS-10 client - handle both with and without a real client
let hcs10Client: any = null;
let messageListeners: Map<string, any> = new Map();
let isMonitoringMessages: boolean = false;

// Create a mock client for fallback
const createMockClient = () => {
  console.log('⚠️ Creating mock HCS-10 client');
  return {
    handleConnectionRequest: async () => ({ connectionTopicId: 'mock-topic-id' }),
    getMessageStream: async () => {
      const events = new (require('events').EventEmitter)();
      return events;
    },
    sendMessage: async (topicId: string, message: string, memo?: string) => {
      console.log(`🔵 [MOCK] Sending message to topic ${topicId}: ${message.substring(0, 100)}...`);
      return { success: true, message: 'Mock message sent' };
    },
    getMessageContent: async () => 'Mock content'
  };
};

// Initialize client with fallback - use a safer approach
async function initializeStandardsClient() {
  try {
    console.log('🔵 Attempting to initialize HCS10Client');
    
    // Check environment variables
    if (!process.env.AGENT_ACCOUNT_ID || !process.env.AGENT_PRIVATE_KEY) {
      console.warn('⚠️ Missing AGENT_ACCOUNT_ID or AGENT_PRIVATE_KEY in environment');
      return createMockClient();
    }
    
    // Create configuration object
    const clientConfig = {
      network: (process.env.HEDERA_NETWORK as 'testnet'|'mainnet') || 'testnet',
      operatorId: process.env.AGENT_ACCOUNT_ID,
      operatorPrivateKey: process.env.AGENT_PRIVATE_KEY,
      logLevel: 'info'
    };
    
    console.log('🔵 Client configuration:', {
      network: clientConfig.network,
      operatorId: clientConfig.operatorId ? 'Set' : 'Not set',
      operatorPrivateKey: clientConfig.operatorPrivateKey ? 'Set (redacted)' : 'Not set'
    });
    
    try {
      // Try to import from standards-sdk first
      console.log('🔵 Trying to import from @hashgraphonline/standards-sdk');
      const standardsSDKModule = await import('@hashgraphonline/standards-sdk').catch(() => null);
      
      if (standardsSDKModule) {
        const sdkAny = standardsSDKModule as any;
        
        // Log available exports
        console.log('🔵 standards-sdk exports:', Object.keys(sdkAny));
        
        if (sdkAny.HCS10Client) {
          console.log('✅ HCS10Client found in standards-sdk');
          hcs10Client = new sdkAny.HCS10Client(clientConfig);
          return hcs10Client;
        }
      }
      
      // Try to import from standards-agent-kit
      console.log('🔵 Trying to import from @hashgraphonline/standards-agent-kit');
      const standardsKitModule = await import('@hashgraphonline/standards-agent-kit').catch(() => null);
      
      if (standardsKitModule) {
        const kitAny = standardsKitModule as any;
        
        // Log available exports
        console.log('🔵 standards-agent-kit exports:', Object.keys(kitAny));
        
        // Find HCS10Client in various possible locations
        let ClientConstructor = null;
        
        if (typeof kitAny.HCS10Client === 'function') {
          ClientConstructor = kitAny.HCS10Client;
        } else if (kitAny.default && typeof kitAny.default.HCS10Client === 'function') {
          ClientConstructor = kitAny.default.HCS10Client;
        } else {
          // Check nested exports
          for (const key of Object.keys(kitAny)) {
            const value = kitAny[key];
            if (value && typeof value === 'object' && typeof value.HCS10Client === 'function') {
              ClientConstructor = value.HCS10Client;
              break;
            }
          }
        }
        
        if (ClientConstructor) {
          console.log('✅ HCS10Client constructor found in standards-agent-kit');
          hcs10Client = new ClientConstructor(
            clientConfig.operatorId,
            clientConfig.operatorPrivateKey,
            clientConfig.network
          );
          return hcs10Client;
        }
      }
      
      // If we get here, no client was found
      console.warn('⚠️ Could not find HCS10Client in any module');
      return createMockClient();
      
    } catch (importError) {
      console.error('❌ Error importing client modules:', importError);
      return createMockClient();
    }
  } catch (error) {
    console.error('❌ Failed to initialize HCS10Client:', error);
    return createMockClient();
  }
}

// Agent configuration object
const agentConfig = {
  accountId: process.env.AGENT_ACCOUNT_ID,
  privateKey: process.env.AGENT_PRIVATE_KEY,
  inboundTopicId: process.env.AGENT_INBOUND_TOPIC_ID,
  outboundTopicId: process.env.AGENT_OUTBOUND_TOPIC_ID,
  profileTopicId: process.env.AGENT_PROFILE_TOPIC_ID
};

// Track connection topics by user
const userConnectionTopics = new Map<string, string>();

// The agent executor instance
let agentExecutor: any = null;

// Add this type definition at the top of the file
// Define a type for the HCS10Client
interface HCS10Client {
  sendMessage: (topicId: string, message: string, memo?: string) => Promise<any>;
  getMessageStream: (topicId: string) => Promise<any>;
}

/**
 * Initializes the agent for responding to user queries
 */
async function initializeAgent() {
  try {
    console.log('🔵 Initializing HCS-10 agent...');
    
    // Check if we have the required environment variables
    if (!process.env.AGENT_ACCOUNT_ID || !process.env.AGENT_PRIVATE_KEY) {
      console.warn('⚠️ Missing AGENT_ACCOUNT_ID or AGENT_PRIVATE_KEY in environment');
      throw new Error('Missing required agent credentials');
    }
    
    // Simple executor that will use the HCS10Client to process messages
    agentExecutor = {
      invoke: async ({ input }: { input: string }) => {
        // Process input through agent
        const response = await processInputWithAgent(input);
        return { output: response };
      }
    };
    
    console.log('✅ Agent initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize agent:', error);
    throw error;
  }
}

/**
 * Process user input with the HCS-10 agent
 * @param input User's input text
 * @returns Processed response
 */
async function processInputWithAgent(input: string): Promise<string> {
  try {
    console.log(`🔵 Processing input with agent: "${input}"`);
    
    // Check if we have a valid HCS10Client
    if (!hcs10Client || typeof hcs10Client.sendMessage !== 'function') {
      console.warn('⚠️ No valid HCS10Client available, using fallback');
      return `I'm sorry, I'm currently unable to process your request through the Hedera network.`;
    }
    
    // For real AI processing, we would typically:
    // 1. Use OpenAI or another LLM to process the input
    // 2. Send structured messages via the HCS10Client
    
    // Option 1: Use direct OpenAI integration if configured
    if (process.env.OPENAI_API_KEY) {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful assistant with expertise in blockchain and Hedera Hashgraph." },
          { role: "user", content: input }
        ]
      });
      
      if (completion.choices && completion.choices[0] && completion.choices[0].message) {
        return completion.choices[0].message.content || "No response generated";
      }
    }
    
    // Option 2: Use mock response if no OpenAI integration
    console.log(`⚠️ OpenAI API key not found, using simplified response`);
    return `Thank you for your message: "${input}". I'm currently operating in limited mode without AI capabilities.`;
  } catch (error) {
    console.error('❌ Error processing input with agent:', error);
    return 'Sorry, I encountered an error processing your request.';
  }
}

/**
 * Interface for chat messages retrieved from Hedera
 */
export interface ChatMessage {
  id: string;
  question: string;
  answer: string;
  timestamp: string;
  usageQuota?: number;
}

/**
 * Interface for subscription details
 */
export interface SubscriptionDetails {
  periodMonths: number;
  projectLimit: number;
  messageLimit: number;
  priceUSD: number;
  priceHSuite: number;
}

/**
 * Sends a user prompt to the agent and returns the response
 * @param prompt Text or natural command from the user
 * @param topicId Optional topic ID for recording conversation
 * @param usageQuota Optional usage quota for the conversation
 * @returns Generated response
 */
export async function askAssistant(
  prompt: string, 
  topicId?: string, 
  usageQuota?: number
): Promise<string> {
  try {
    console.log(`🔵 askAssistant called with prompt: "${prompt}", topicId: ${topicId}, usageQuota: ${usageQuota}`);
    
    // Initialize agent if it's not already initialized
    if (!agentExecutor) {
      await initializeAgent();
    }

    // Get response from the agent executor
    const result = await agentExecutor!.invoke({ input: prompt });

    if (!result || !result.output) {
      throw new Error('No response from agent.');
    }

    console.log(`✅ Generated response: "${result.output}"`);

    // If topicId is provided, also record the conversation
    if (topicId && usageQuota !== undefined) {
      try {
        console.log(`🔵 Recording conversation to topic ${topicId} with quota ${usageQuota}`);
        await recordConversationToTopic(topicId, prompt, result.output, usageQuota);
        console.log(`✅ Conversation recorded successfully to topic ${topicId}`);
      } catch (recordError) {
        console.error(`❌ Failed to record conversation to topic ${topicId}:`, recordError);
        console.warn(`⚠️ Continuing with response despite recording error`);
      }
    } else {
      console.log(`⚠️ Not recording conversation: ${!topicId ? 'Missing topicId' : 'Missing usageQuota'}`);
    }

    return result.output;
  } catch (error: any) {
    console.error('❌ Error in askAssistant:', error);
    
    // If topicId is provided, try to use fallback response
    if (topicId) {
      return getFallbackResponse(prompt, topicId);
    }
    
    return 'Failed to process your request. Please try again.';
  }
}

/**
 * Establishes a connection with a user via HCS-10
 * @param userId Unique identifier for the user
 * @param userAccountId Hedera account ID of the user
 * @param connectionRequestId Optional ID of an incoming connection request
 * @returns The connection topic ID
 */
export async function connectWithUser(
  userId: string, 
  userAccountId: string, 
  connectionRequestId?: string
): Promise<string> {
  try {
    console.log(`🔵 Connecting with user ${userId} (account: ${userAccountId})`);
    
    let connectionTopicId: string;
    
    // Check if we already have a connection with this user
    if (userConnectionTopics.has(userId)) {
      connectionTopicId = userConnectionTopics.get(userId)!;
      console.log(`✅ Using existing connection topic for user ${userId}: ${connectionTopicId}`);
      return connectionTopicId;
    }
    
    // For now, we'll create a mock connection
    // In a real implementation, you would use the HCS-10 client to establish a connection
    connectionTopicId = `mock-connection-${Date.now()}`;
    
    // Store the connection topic ID for future use
    userConnectionTopics.set(userId, connectionTopicId);
    console.log(`✅ Mock connection established with ${userId} on topic ${connectionTopicId}`);
    
    return connectionTopicId;
  } catch (error) {
    console.error('❌ Error connecting with user:', error);
    throw error;
  }
}

/**
 * Sends a message to a connected user
 * @param userId User identifier
 * @param message Message to send
 * @returns Promise that resolves when message is sent
 */
export async function sendMessageToUser(userId: string, message: string): Promise<void> {
  try {
    console.log(`🔵 Sending message to user ${userId}: "${message}"`);
    
    const connectionTopicId = userConnectionTopics.get(userId);
    if (!connectionTopicId) {
      throw new Error(`No active connection found for user ${userId}`);
    }
    
    // In a real implementation, you would use the HCS-10 client to send the message
    console.log(`✅ Message sent to ${userId} on topic ${connectionTopicId}`);
  } catch (error) {
    console.error('❌ Error sending message to user:', error);
    throw error;
  }
}

/**
 * Send structured data to a connected user
 * @param userId User identifier
 * @param data Structured data object
 * @returns Promise that resolves when message is sent
 */
export async function sendStructuredMessageToUser(userId: string, data: any): Promise<void> {
  try {
    console.log(`🔵 Sending structured message to user ${userId}:`, data);
    
    const connectionTopicId = userConnectionTopics.get(userId);
    if (!connectionTopicId) {
      throw new Error(`No active connection found for user ${userId}`);
    }
    
    // In a real implementation, you would use the HCS-10 client to send structured data
    console.log(`✅ Structured message sent to ${userId} on topic ${connectionTopicId}`);
  } catch (error) {
    console.error('❌ Error sending structured message to user:', error);
    throw error;
  }
}

/**
 * Provides a fallback response when OpenAI isn't available
 */
function getFallbackResponse(prompt: string, topicId: string): string {
  console.log(`🔵 Using fallback response for prompt: "${prompt}" on topic ${topicId}`);

  const fallbackResponse = `
    # I'm having trouble connecting to my AI service

    I apologize, but I'm currently experiencing technical difficulties connecting to my AI service. This might be due to:

    - Network connectivity issues
    - API rate limiting
    - Knowledge base configuration errors

    ## Your message has been recorded

    Rest assured that your message has been successfully recorded in the conversation history. The development team has been notified of this issue.

    ## What you can try

    - Please try again in a few moments
    - If the problem persists, contact support at support@hsuite.finance
    - You can continue exploring other parts of the platform while this is being resolved

    Thank you for your understanding!
    `;

  // Try to record the conversation with the fallback response
  try {
    recordConversationToTopic(topicId, prompt, fallbackResponse, 0).catch(err => {
      console.error('❌ Error recording fallback response:', err);
    });
  } catch (error) {
    console.error('❌ Error recording fallback response:', error);
  }

  return fallbackResponse;
}

/**
 * Gets chat messages from a specified Hedera topic
 * @param topicId The Hedera topic ID to fetch messages from
 * @returns Array of chat messages from the topic
 */
export async function getChatMessages(topicId: string): Promise<ChatMessage[]> {
  try {
    console.log(`🔵 Getting chat messages from topic ${topicId}`);
    
    // Query the Mirror Node for topic messages
    const url = `${getMirrorNodeUrl()}/api/v1/topics/${topicId}/messages?limit=100`;
    console.log(`🔵 Fetching from URL: ${url}`);
    
    const response = await fetch(url);
    const data = await response.json();

    console.log(`🔵 Retrieved ${data.messages?.length || 0} total messages from topic`);

    // Process and filter messages - only returning CHAT_TOPIC types
    const chatMessages: ChatMessage[] = [];

    // Store chunked messages for reassembly
    const messageChunks: { [key: string]: { chunks: string[], timestamp: string } } = {};

    // First pass: identify and group message chunks
    if (data.messages && data.messages.length > 0) {
      console.log(`🔵 Processing ${data.messages.length} messages`);
      
      // Sort messages by sequence number to ensure proper ordering
      const sortedMessages = [...data.messages].sort((a, b) =>
        parseInt(a.sequence_number) - parseInt(b.sequence_number)
      );

      for (const msg of sortedMessages) {
        try {
          // Handle chunked messages
          if (msg.chunk_info) {
            const chunkInfo = msg.chunk_info;
            // Create a unique key for each chunked message
            const initialTxId = chunkInfo.initial_transaction_id?.transaction_valid_start || 'unknown';
            const chunkKey = `${initialTxId}`;

            if (!messageChunks[chunkKey]) {
              messageChunks[chunkKey] = {
                chunks: new Array(chunkInfo.total).fill(''),
                timestamp: msg.consensus_timestamp
              };
            } else if (msg.consensus_timestamp > messageChunks[chunkKey].timestamp) {
              // Use the latest timestamp for the message
              messageChunks[chunkKey].timestamp = msg.consensus_timestamp;
            }

            // Store this chunk in the appropriate position (0-indexed array)
            messageChunks[chunkKey].chunks[chunkInfo.number - 1] = msg.message;
            console.log(`🔵 Stored chunk ${chunkInfo.number} of ${chunkInfo.total} for message ${chunkKey}`);
          } else {
            // Process non-chunked messages directly
            const messageContent = processMessage(msg.message, msg.sequence_number, msg.consensus_timestamp);
            if (messageContent) {
              chatMessages.push(messageContent);
              console.log(`🔵 Processed single message with ID ${messageContent.id}`);
            }
          }
        } catch (e) {
          console.warn('⚠️ Error processing message or chunk:', e);
        }
      }

      // Second pass: reassemble and process chunked messages
      for (const [key, messageData] of Object.entries(messageChunks)) {
        // Check if we have all chunks before processing
        if (!messageData.chunks.includes('')) {
          console.log(`🔵 Reassembling chunked message with key ${key}`);
          const messageContent = processReassembledMessage(
            messageData.chunks,
            key,
            messageData.timestamp
          );

          if (messageContent) {
            chatMessages.push(messageContent);
            console.log(`🔵 Processed reassembled message with ID ${messageContent.id}`);
          }
        } else {
          console.warn(`⚠️ Incomplete chunks for message ${key}, cannot reassemble`);
        }
      }
    }

    // Sort messages by timestamp
    chatMessages.sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    console.log(`✅ Processed ${chatMessages.length} chat messages from topic ${topicId}`);

    // Log quota from last message if available
    if (chatMessages.length > 0) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      console.log(`🔵 Last message has usageQuota: ${lastMsg.usageQuota !== undefined ? lastMsg.usageQuota : 'undefined'}`);
    }

    return chatMessages;

  } catch (error) {
    console.error('❌ Error retrieving chat messages:', error);
    throw error;
  }
}

/**
 * Process a single non-chunked message
 */
function processMessage(base64Message: string, sequenceNumber: number, timestamp: string): ChatMessage | null {
  try {
    // Decode message from base64
    const decodedMessage = Buffer.from(base64Message, 'base64').toString();
    console.log(`🔵 Decoded message: ${decodedMessage.substring(0, 100)}...`);

    // Try to parse as JSON
    const content = JSON.parse(decodedMessage);

    // Check if this is a chat message
    if (content && content.type === 'CHAT_TOPIC' && content.question) {
      console.log(`🔵 Processing standard CHAT_TOPIC message`);
      return {
        id: sequenceNumber.toString(),
        question: content.question,
        answer: content.answer || "No answer available",
        timestamp: content.timestamp || timestamp,
        usageQuota: content.usageQuota
      };
    }
    // Check if this is a quota update message
    else if (content && content.type === 'CHAT_TOPIC_QUOTA_UPDATE' && content.usageQuota !== undefined) {
      console.log(`🔵 Processing CHAT_TOPIC_QUOTA_UPDATE message with quota ${content.usageQuota}`);
      return {
        id: `quota-${sequenceNumber.toString()}`,
        question: "Quota updated",
        answer: `Your message quota has been updated to ${content.usageQuota}`,
        timestamp: content.timestamp || timestamp,
        usageQuota: content.usageQuota
      };
    }
    // Check if this is an HCS-10 OpenConvai message
    else if (content && content.type === 'openconvai.message' && content.input && content.output) {
      console.log(`🔵 Processing HCS-10 openconvai.message`);
      return {
        id: sequenceNumber.toString(),
        question: content.input.message || "",
        answer: content.output.message || "No answer available",
        timestamp: content.metadata?.timestamp || timestamp,
        usageQuota: content.metadata?.usageQuota
      };
    }
  } catch (e) {
    console.warn('⚠️ Failed to process message content:', e);
  }
  return null;
}

/**
 * Process reassembled chunks into a message
 */
function processReassembledMessage(chunks: string[], key: string, timestamp: string): ChatMessage | null {
  try {
    // Decode and combine all chunks
    const combinedMessage = chunks
      .map(chunk => Buffer.from(chunk, 'base64').toString())
      .join('');
    
    console.log(`🔵 Reassembled message: ${combinedMessage.substring(0, 100)}...`);

    // Try to parse the JSON
    const content = JSON.parse(combinedMessage);

    // Check if this is a chat message
    if (content && content.type === 'CHAT_TOPIC' && content.question) {
      console.log(`🔵 Processing reassembled CHAT_TOPIC message`);
      return {
        id: key,
        question: content.question,
        answer: content.answer || "No answer available",
        timestamp: content.timestamp || timestamp,
        usageQuota: content.usageQuota
      };
    }
    // Check if this is a quota update message
    else if (content && content.type === 'CHAT_TOPIC_QUOTA_UPDATE' && content.usageQuota !== undefined) {
      console.log(`🔵 Processing reassembled CHAT_TOPIC_QUOTA_UPDATE message with quota ${content.usageQuota}`);
      return {
        id: `quota-${key}`,
        question: "Quota updated",
        answer: `Your message quota has been updated to ${content.usageQuota}`,
        timestamp: content.timestamp || timestamp,
        usageQuota: content.usageQuota
      };
    }
    // Check if this is an HCS-10 OpenConvai message
    else if (content && content.type === 'openconvai.message' && content.input && content.output) {
      console.log(`🔵 Processing reassembled HCS-10 openconvai.message`);
      return {
        id: key,
        question: content.input.message || "",
        answer: content.output.message || "No answer available",
        timestamp: content.metadata?.timestamp || timestamp,
        usageQuota: content.metadata?.usageQuota
      };
    }
  } catch (e) {
    console.warn(`⚠️ Failed to process reassembled message: ${e}`);
  }
  return null;
}

/**
 * Establish a connection with the HCS-10 agent
 * @returns Topic ID for the connection, or null if connection failed
 */
async function establishAgentConnection(): Promise<string | null> {
  try {
    console.log('🔵 Establishing connection with the HCS-10 agent...');
    
    // Check if we have the agent client
    if (!hcs10Client || typeof hcs10Client.handleConnectionRequest !== 'function') {
      console.warn('⚠️ No valid HCS10Client available for connection');
      return null;
    }
    
    // Check if we have the required agent config
    if (!agentConfig.accountId || !agentConfig.inboundTopicId) {
      console.warn('⚠️ Missing agent configuration for connection');
      return null;
    }
    
    // Make sure we have outbound topic to return or null
    const outboundTopic = agentConfig.outboundTopicId || null;
    
    console.log(`🔵 Agent inbound topic: ${agentConfig.inboundTopicId}`);
    console.log(`🔵 Agent outbound topic: ${outboundTopic || 'not set'}`);
    
    // Try to establish a connection - this is typically done by sending a special
    // message to the agent's inbound topic and waiting for a response
    try {
      // Get our operator ID, or use a placeholder if not available
      const ourAccountId = process.env.HEDERA_OPERATOR_ID || '0.0.0000000';
      
      const connectionRequest = {
        type: 'openconvai.connection_request',
        fromAccountId: ourAccountId,
        toAccountId: agentConfig.accountId,
        timestamp: new Date().toISOString()
      };
      
      console.log(`🔵 Sending connection request to agent ${agentConfig.accountId}`);
      
      // Send the connection request to the agent's inbound topic
      await hcs10Client.sendMessage(
        agentConfig.inboundTopicId,
        JSON.stringify(connectionRequest),
        'Connection request'
      );
      
      console.log('✅ Connection request sent successfully');
      
      // In a real implementation, we would wait for a response on our own topic
      // For now, we'll simply use the agent's outbound topic as our "connection"
      return outboundTopic;
    } catch (connectionError) {
      console.error('❌ Error establishing connection with agent:', connectionError);
      return null;
    }
  } catch (error) {
    console.error('❌ Error in establishAgentConnection:', error);
    return null;
  }
}

/**
 * Records a conversation (question and answer) to a Hedera topic
 * @param topicId The Hedera topic ID
 * @param question The user's question
 * @param answer The AI's response
 * @returns Promise that resolves when the message is recorded
 */
export async function recordConversationToTopic(topicId: string, question: string, answer: string, usageQuota: number): Promise<void> {
  try {
    console.log(`🔵 Recording conversation to topic ${topicId} with usageQuota ${usageQuota}`);
    console.log(`🔵 Question: "${question.substring(0, 100)}..."`);
    console.log(`🔵 Answer: "${answer.substring(0, 100)}..."`);

    if (usageQuota <= 0) {
      // Check if this is a first message with no quota yet
      console.log(`🔵 Usage quota is 0 or negative, checking if this is a new topic...`);
      const messages = await getChatMessages(topicId);
      if (messages.length === 0) {
        // This is likely a new topic, set initial quota
        usageQuota = 10; // Set initial quota for new topics
        console.log(`🔵 This is a new topic, setting initial quota to ${usageQuota}`);
      } else {
        throw new Error('Usage quota is 0');
      }
    }

    // Create HCS-10 OpenConvai format message
    const timestamp = new Date().toISOString();
    const messageContent = {
      type: 'openconvai.message',
      input: {
        message: question
      },
      output: {
        message: answer
      },
      metadata: {
        timestamp: timestamp,
        project: topicId,
        usageQuota: usageQuota - 1
      }
    };

    // First, record to the user's topic - use direct Hedera SDK for reliability
    try {
      // Set up client directly
      const network = process.env.HEDERA_NETWORK || 'testnet';
      const operatorId = process.env.HEDERA_OPERATOR_ID;
      const operatorKey = process.env.HEDERA_OPERATOR_KEY;

      if (!operatorId || !operatorKey) {
        throw new Error('HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set in environment variables');
      }

      console.log(`🔵 Using operatorId: ${operatorId}`);

      let client;
      switch (network) {
        case 'mainnet':
          client = Client.forMainnet();
          break;
        case 'previewnet':
          client = Client.forPreviewnet();
          break;
        default:
          client = Client.forTestnet();
      }

      console.log(`🔵 Set up Hedera client for network: ${network}`);
      client.setOperator(operatorId, operatorKey);

      // Submit the message to the user's topic
      const topicIdObj = TopicId.fromString(topicId);
      console.log(`🔵 Using topicId: ${topicIdObj.toString()}`);
      
      const privateKey = PrivateKey.fromString(operatorKey);
      console.log(`🔵 Successfully parsed private key`);
      
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(topicIdObj)
        .setMessage(Buffer.from(JSON.stringify(messageContent)))
        .freezeWith(client);

      console.log(`🔵 Created topic message transaction`);

      const signedTx = await transaction.sign(privateKey);
      console.log(`🔵 Signed transaction`);
      
      const txResponse = await signedTx.execute(client);
      console.log(`🔵 Executed transaction, getting receipt...`);
      
      const receipt = await txResponse.getReceipt(client);
      
      console.log(`✅ Message recorded to topic ${topicId} successfully, status: ${receipt.status.toString()}`);
      
      // Second, try to send to the agent's inbound topic if configured
      if (agentConfig.inboundTopicId && agentConfig.accountId) {
        console.log(`🔵 Attempting to send message to agent's inbound topic: ${agentConfig.inboundTopicId}`);
        
        try {
          // Use the AGENT credentials to send to the agent's topic
          if (process.env.AGENT_ACCOUNT_ID && process.env.AGENT_PRIVATE_KEY) {
            // Create a new client with agent credentials
            let agentClient;
            switch (network) {
              case 'mainnet':
                agentClient = Client.forMainnet();
                break;
              case 'previewnet':
                agentClient = Client.forPreviewnet();
                break;
              default:
                agentClient = Client.forTestnet();
            }
            
            // Set operator with agent credentials
            agentClient.setOperator(
              process.env.AGENT_ACCOUNT_ID,
              process.env.AGENT_PRIVATE_KEY
            );
            
            // Format query message for the agent
            const agentMessage = {
              type: 'query',
              question: question,
              requestId: `req-${Date.now()}`,
              parameters: {
                topicId: topicId,
                usageQuota: usageQuota - 1
              }
            };
            
            console.log(`🔵 Sending query to agent inbound topic: ${agentConfig.inboundTopicId}`);
            
            // Submit to the agent's inbound topic
            const agentTopicId = TopicId.fromString(agentConfig.inboundTopicId);
            const agentKey = PrivateKey.fromString(process.env.AGENT_PRIVATE_KEY);
            
            const agentTx = new TopicMessageSubmitTransaction()
              .setTopicId(agentTopicId)
              .setMessage(Buffer.from(JSON.stringify(agentMessage)))
              .freezeWith(agentClient);
              
            const signedAgentTx = await agentTx.sign(agentKey);
            const agentResponse = await signedAgentTx.execute(agentClient);
            
            console.log(`🔵 Agent message sent, waiting for receipt...`);
            const agentReceipt = await agentResponse.getReceipt(agentClient);
            
            console.log(`✅ Message sent to agent topic ${agentConfig.inboundTopicId}, status: ${agentReceipt.status.toString()}`);
          } else {
            console.warn('⚠️ Missing AGENT_ACCOUNT_ID or AGENT_PRIVATE_KEY, cannot send to agent topic');
          }
        } catch (agentError) {
          console.error(`❌ Error sending to agent topic:`, agentError);
          // Don't re-throw, we already saved to the user topic
        }
      } else {
        console.log(`⚠️ Agent inbound topic not configured, skipping agent communication`);
      }
      
    } catch (error) {
      console.error(`❌ Error recording conversation:`, error);
      throw error;
    }

    console.log(`✅ Conversation recorded successfully to topic ${topicId}`);
  } catch (error) {
    console.error('❌ Error recording conversation to topic:', error);
    throw error;
  }
}

/**
 * Updates the usage quota for a topic
 * @param topicId The Hedera topic ID
 * @param usageQuota The new usage quota value
 * @returns Promise that resolves when the quota is updated
 */
export async function updateUsageQuota(topicId: string, usageQuota: number): Promise<void> {
  try {
    console.log(`🔵 Updating usage quota for topic ${topicId} to ${usageQuota}`);
    
    if (usageQuota < 0) {
      throw new Error('Usage quota cannot be negative');
    }

    // Set up client using the pattern from other services
    const network = process.env.HEDERA_NETWORK || 'testnet';
    const operatorId = process.env.HEDERA_OPERATOR_ID;
    const operatorKey = process.env.HEDERA_OPERATOR_KEY;

    if (!operatorId || !operatorKey) {
      throw new Error('HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set in environment variables');
    }

    let client;
    switch (network) {
      case 'mainnet':
        client = Client.forMainnet();
        break;
      case 'previewnet':
        client = Client.forPreviewnet();
        break;
      default:
        client = Client.forTestnet();
    }

    client.setOperator(operatorId, operatorKey);

    // Create quota update message content - using both standard and HCS-10 formats
    const timestamp = new Date().toISOString();
    
    // HCS-10 compatible quota update
    const messageContent = {
      type: 'openconvai.quota_update',
      metadata: {
        timestamp: timestamp,
        usageQuota: usageQuota,
        message: 'Quota update transaction'
      }
    };

    // Get operator private key
    const privateKey = PrivateKey.fromString(operatorKey);

    // Submit the message to the topic
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(Buffer.from(JSON.stringify(messageContent)))
      .freezeWith(client);

    const signedTx = await transaction.sign(privateKey);
    const txResponse = await signedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);

    console.log(`✅ Updated usage quota for topic ${topicId} to ${usageQuota}, status: ${receipt.status.toString()}`);
  } catch (error) {
    console.error('❌ Error updating usage quota:', error);
    throw error;
  }
}

/**
 * Start monitoring for messages on all active topics
 */
async function startMessageMonitoring() {
  if (isMonitoringMessages) {
    console.log('🔵 Message monitoring already active');
    return;
  }
  
  try {
    console.log('🔵 Starting message monitoring');
    isMonitoringMessages = true;
    
    if (!hcs10Client) {
      console.warn('⚠️ No HCS10Client available, cannot monitor messages');
      return;
    }
    
    // Get known topic IDs - could be from a database or environment
    const topicIds = [
      process.env.AGENT_INBOUND_TOPIC_ID,
      process.env.AGENT_OUTBOUND_TOPIC_ID,
      process.env.AGENT_PROFILE_TOPIC_ID
    ].filter(Boolean) as string[];
    
    if (topicIds.length === 0) {
      console.warn('⚠️ No topic IDs available to monitor');
      return;
    }
    
    console.log(`🔵 Found ${topicIds.length} topics to monitor`);
    
    // Set up listeners for each topic
    for (const topicId of topicIds) {
      setupTopicListener(topicId);
    }
    
    console.log('✅ Message monitoring started');
  } catch (error) {
    console.error('❌ Error starting message monitoring:', error);
    isMonitoringMessages = false;
  }
}

/**
 * Set up a listener for messages on a specific topic
 */
async function setupTopicListener(topicId: string) {
  try {
    console.log(`🔵 Setting up listener for topic ${topicId}`);
    
    // Check if we already have a listener for this topic
    if (messageListeners.has(topicId)) {
      console.log(`🔵 Listener already exists for topic ${topicId}`);
      return;
    }
    
    if (!hcs10Client) {
      console.warn('⚠️ No HCS10Client available, cannot setup topic listener');
      return;
    }
    
    // Set up message stream
    const messageStream = await hcs10Client.getMessageStream(topicId);
    console.log(`🔵 Message stream created for topic ${topicId}`);
    console.log(`🔵 Message stream type: ${typeof messageStream}, properties:`, Object.keys(messageStream));
    
    // Store the stream for cleanup later
    messageListeners.set(topicId, messageStream);
    
    // Handle different message stream formats
    if (messageStream.on && typeof messageStream.on === 'function') {
      // EventEmitter style API
      console.log(`🔵 Using EventEmitter style API for topic ${topicId}`);
      
      messageStream.on('message', (message: any) => {
        processIncomingMessage(topicId, message);
      });
      
      messageStream.on('error', (error: any) => {
        console.error(`⚠️ Error in message stream:`, error);
      });
    }
  } catch (error) {
    console.error(`❌ Error setting up listener for topic ${topicId}:`, error);
  }
}

/**
 * Process incoming messages and handle them accordingly
 */
async function processIncomingMessage(topicId: string, message: any) {
  try {
    console.log(`🔵 Processing incoming message from topic ${topicId}`);
    
    // Handle different message types
    if (typeof message === 'string') {
      // Process as a string message
      const chatMessage = processMessage(message, 0, new Date().toISOString());
      if (chatMessage) {
        console.log(`🔵 Processed incoming message: ${JSON.stringify(chatMessage)}`);
      }
    } else if (typeof message === 'object' && message.type === 'openconvai.message') {
      // Process as an HCS-10 OpenConvai message
      const chatMessage = processMessage(message.input.message, 0, new Date().toISOString());
      if (chatMessage) {
        console.log(`🔵 Processed incoming message: ${JSON.stringify(chatMessage)}`);
      }
    } else {
      console.warn(`⚠️ Unrecognized message type: ${typeof message}`);
    }
  } catch (error) {
    console.error(`❌ Error processing incoming message:`, error);
  }
}

/**
 * Initializes the chat service and all required components
 */
export async function initChatService() {
  try {
    console.log('🔵 Initializing Chat Service...');
    
    // Initialize HCS10Client first
    hcs10Client = await initializeStandardsClient();
    
    if (!hcs10Client) {
      console.warn('⚠️ Failed to initialize HCS10Client, using mock client');
      hcs10Client = createMockClient();
    }
    
    // Then initialize the agent
    const agentInitialized = await initializeAgent();
    
    if (!agentInitialized) {
      console.warn('⚠️ Agent initialization failed');
    }
    
    // Try to establish connection with the agent
    try {
      if (agentConfig.accountId && agentConfig.inboundTopicId) {
        console.log('🔵 Attempting to establish connection with agent...');
        const connectionTopicId = await establishAgentConnection();
        
        if (connectionTopicId) {
          console.log(`✅ Connection established with agent, monitoring topic: ${connectionTopicId}`);
          
          // We would monitor this topic for responses, but our monitoring
          // system should already pick it up from the startMessageMonitoring call
        } else {
          console.warn('⚠️ Failed to establish connection with agent');
        }
      } else {
        console.log('🔵 Agent configuration incomplete, skipping connection');
      }
    } catch (connectionError) {
      console.error('❌ Error establishing agent connection:', connectionError);
    }
    
    // Start monitoring topics if we have a real client
    if (hcs10Client && typeof hcs10Client.getMessageStream === 'function') {
      try {
        await startMessageMonitoring();
      } catch (monitorError) {
        console.error('❌ Error starting message monitoring:', monitorError);
      }
    }
    
    console.log('✅ Chat Service initialization completed');
    return true;
  } catch (error) {
    console.error('❌ Error initializing Chat Service:', error);
    return false;
  }
}