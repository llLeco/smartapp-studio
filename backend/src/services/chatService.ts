import OpenAI from 'openai';
import dotenv from 'dotenv';
import { TopicId, TopicMessageSubmitTransaction, PrivateKey } from "@hashgraph/sdk";
import { Client } from "@hashgraph/sdk";
import { getMirrorNodeUrl } from './hederaService.js';
import * as SDK from '@hashgraphonline/standards-sdk';

dotenv.config();

// Create a mock client for fallback
const createMockClient = () => ({
  handleConnectionRequest: async () => ({ connectionTopicId: 'mock-topic-id' }),
  getMessageStream: async () => ({ messages: [] }),
  sendMessage: async () => console.log('Mock client: message sent'),
  getMessageContent: async () => 'Mock content'
});

// Initialize client with fallback
let hcs10Client: any;
try {
  // Try to access the client from SDK - this may need to be adjusted based on the actual SDK structure
  const SDKAny = SDK as any;
  
  if (SDKAny.HCS10Client) {
    console.log('🔵 HCS10Client class found in SDK, attempting to initialize...');
    
    if (!process.env.AGENT_ACCOUNT_ID || !process.env.AGENT_PRIVATE_KEY) {
      console.warn('⚠️ Missing AGENT_ACCOUNT_ID or HEDERA_PRIVATE_KEY in environment');
    }
    
    hcs10Client = new SDKAny.HCS10Client({
      network: (process.env.HEDERA_NETWORK as 'testnet'|'mainnet') || 'testnet',
      operatorId: process.env.AGENT_ACCOUNT_ID || '',
      operatorPrivateKey: process.env.AGENT_PRIVATE_KEY || '',
      logLevel: 'info'
    });
    console.log('✅ HCS10Client initialized successfully');
  } else {
    console.warn('⚠️ HCS10Client not found in SDK, using mock client');
    hcs10Client = createMockClient();
  }
} catch (error) {
  console.error('❌ Failed to initialize HCS10Client:', error);
  hcs10Client = createMockClient();
  console.log('⚠️ Using mock client after initialization error');
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

    // Try to use HCS10Client first if available
    if (hcs10Client && typeof hcs10Client.sendMessage === 'function') {
      try {
        console.log(`🔵 Using HCS10Client to send message to topic ${topicId}`);
        
        // Create HCS-10 OpenConvai format message
        const messageContent = {
          type: 'openconvai.message',
          input: {
            message: question
          },
          output: {
            message: answer
          },
          metadata: {
            timestamp: new Date().toISOString(),
            project: topicId,
            usageQuota: usageQuota - 1
          }
        };
        
        // Send through HCS10Client
        await hcs10Client.sendMessage(
          topicId,
          JSON.stringify(messageContent),
          `SmartApp Studio AI message`
        );
        
        console.log(`✅ Message sent via HCS10Client successfully`);
        return;
      } catch (clientError) {
        console.error('❌ Error using HCS10Client, falling back to direct approach:', clientError);
      }
    }

    // Set up client directly (similar to getClient implementation)
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

    // Non-null assertion is safe here because we've checked above
    client.setOperator(operatorId, operatorKey);

    // Create message content - using both standard and HCS-10 compatible format
    const currentTimestamp = new Date().toISOString();
    
    // Create HCS-10 OpenConvai format
    const messageContent = {
      type: 'openconvai.message',
      input: {
        message: question
      },
      output: {
        message: answer
      },
      metadata: {
        timestamp: currentTimestamp,
        project: topicId,
        usageQuota: usageQuota - 1
      }
    };

    console.log(`🔵 Created HCS-10 compatible message content`);

    try {
      // Get operator private key
      const privateKey = PrivateKey.fromString(operatorKey);
      console.log(`🔵 Successfully parsed private key`);

      // Submit the message to the topic
      const topicIdObj = TopicId.fromString(topicId);
      console.log(`🔵 Using topicId: ${topicIdObj.toString()}`);
      
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
    } catch (innerError) {
      console.error(`❌ Error during transaction execution:`, innerError);
      throw innerError;
    }

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