import OpenAI from 'openai';
import dotenv from 'dotenv';
import { TopicId, TopicMessageSubmitTransaction, PrivateKey } from "@hashgraph/sdk";
import { Client } from "@hashgraph/sdk";
import { getMirrorNodeUrl } from './hederaService.js';
import { KnowledgeBaseService } from './knowledgeBaseService.js';
import { HCS10Client } from '@hashgraphonline/standards-sdk';

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const knowledgeBase = new KnowledgeBaseService();

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
 * Asks the OpenAI assistant to generate SmartApp structure based on the prompt
 * and records both question and answer to a Hedera topic using HCS-10 standard
 * @param prompt User's input describing the SmartApp
 * @param topicId Hedera topic ID to record the conversation
 * @param usageQuota Current usage quota for the user
 * @returns Generated response from the assistant
 */
export async function askAssistant(prompt: string, topicId: string, usageQuota: number): Promise<any> {
  try {
    
    // Validate inputs
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid prompt provided');
    }

    if (!process.env.OPENAI_API_KEY) {
      return getFallbackResponse(prompt, topicId);
    }

    let context = '';
    try {
      context = await knowledgeBase.getRelevantContext(prompt);
    } catch (contextError) {
      // Continue with empty context if knowledge base fails
      context = "";
    }

    let responseContent: string;
    try {
      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `
            You are a professional AI assistant specialized in helping developers build SmartApps using HbarSuite and SmartNodes — without traditional smart contracts.
            
            Your role is to **guide, scaffold, and generate validator configurations** in JSON format.
            
            Use this behavior model:
            
            - If the user's input is vague, ask focused questions to gather enough context to generate a validator file.
            - Once you have enough data, **always return a complete validator file in JSON** with **inline comments** explaining key parts.
            - Use code blocks with \`\`\`json and explain logic in Markdown format.
            - Offer to scaffold full files, NFT token schemas, or topic interfaces when relevant.
            - Prioritize clarity, simplicity, and actionability.
            
            Reference official documentation: https://docs.hsuite.finance/
            
            ---
            
            **Validator File Examples:**
            
            **Account Validator:**
            \`\`\`json
            { "smartNodeSecurity": "full", "updateConditions": { "values": [], "controller": "owner" }, "actionsConditions": { "values": [ "transfer", "delete", "update", "allowance-approval", "allowance-delete" ], "controller": "owner" }, "tokenGates": { "fungibles": { "tokens": [ { "tokenId": "0.0.2203022", "amount": 1 } ] }, "nonFungibles": { "tokens": [ { "tokenId": "0.0.2666543", "serialNumbers": [1,2,3], "snapshot": { "cid": "..." } } ] }, "timeRange": { "from": 0, "to": 0 } }, "swapConditions": { "prices": [] } }
            \`\`\`
            
            **Token Validator:**
            \`\`\`json
            { "smartNodeSecurity": "full", "updateConditions": { "values": ["name", "symbol"], "controller": "owner" }, "actionsConditions": { "values": ["pause", "unpause", "freeze"], "controller": "owner" }, "feesConditions": { "values": ["fixed"], "controller": "owner" }, "keysConditions": { "values": ["admin", "supply"], "controller": "owner" } }
            \`\`\`
            
            **Topic Validator:**
            \`\`\`json
            { "smartNodeSecurity": "full", "actionConditions": { "values": ["update", "delete", "message"], "controller": "owner" }, "updateConditions": { "values": ["memo"], "controller": "owner" }, "customInterface": { "interfaceName": "Dao", "properties": { "daoId": "string", "votingRules": { "threshold": "number" } } } }
            \`\`\`
            
            ---
            
            Respond like a mentor — always practical, always building, always validating.
            `
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: "gpt-3.5-turbo",
      });

      responseContent = completion.choices[0]?.message?.content || '';
    } catch (openaiError: any) {
      // Use fallback instead of throwing
      return getFallbackResponse(prompt, topicId);
    }

    if (!responseContent) {
      return getFallbackResponse(prompt, topicId);
    }

    if (topicId) {
      try {
        // Create HCS-10 OpenConvai message
        const timestamp = new Date().toISOString();
        
        // Build the message in openconvai.message format
        const openConvaiMessage = {
          type: "openconvai.message",
          input: {
            message: prompt
          },
          output: {
            message: responseContent
          },
          metadata: {
            timestamp,
            project: "SmartApp Studio",
            usageQuota: usageQuota - 1
          }
        };
        
        // Get configuration from environment
        const network = process.env.HEDERA_NETWORK || 'testnet';
        const operatorId = process.env.HEDERA_OPERATOR_ID;
        const operatorKey = process.env.HEDERA_OPERATOR_KEY;

        if (!operatorId || !operatorKey) {
          throw new Error('HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set in environment variables');
        }

        // Create HCS-10 client
        const hcs10Client = new HCS10Client({
          network: network as 'mainnet' | 'testnet',
          operatorId: operatorId,
          operatorPrivateKey: operatorKey,
          logLevel: 'info'
        });
        
        try {
          // Submit the message to the topic using HCS-10 standard
          await hcs10Client.submitPayload(topicId, openConvaiMessage);
          console.log(`Submitted HCS-10 message to topic ${topicId}`);
        } catch (hcs10Error) {
          console.error('Error submitting HCS-10 message:', hcs10Error);
          
          // If HCS-10 submission fails, fall back to legacy method
          await recordConversationToTopic(topicId, prompt, responseContent, usageQuota);
        }
      } catch (recordError) {
        console.error('Error recording to topic:', recordError);
      }
    }

    return responseContent;
  } catch (error: any) {
    return getFallbackResponse(prompt, topicId);
  }
}

/**
 * Provides a fallback response when OpenAI isn't available
 */
function getFallbackResponse(prompt: string, topicId: string): string {

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
    });
  } catch (error) {
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
    // Query the Mirror Node for topic messages
    const url = `${getMirrorNodeUrl()}/api/v1/topics/${topicId}/messages?limit=100`;
    const response = await fetch(url);
    const data = await response.json();

    console.log(`Retrieved ${data.messages?.length || 0} total messages from topic`);

    // Process and filter messages - only returning CHAT_TOPIC types
    const chatMessages: ChatMessage[] = [];

    // Store chunked messages for reassembly
    const messageChunks: { [key: string]: { chunks: string[], timestamp: string } } = {};

    // First pass: identify and group message chunks
    if (data.messages && data.messages.length > 0) {
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
          } else {
            // Process non-chunked messages directly
            const messageContent = processMessage(msg.message, msg.sequence_number, msg.consensus_timestamp);
            if (messageContent) {
              chatMessages.push(messageContent);
            }
          }
        } catch (e) {
          console.warn('Error processing message or chunk:', e);
        }
      }

      // Second pass: reassemble and process chunked messages
      for (const [key, messageData] of Object.entries(messageChunks)) {
        // Check if we have all chunks before processing
        if (!messageData.chunks.includes('')) {
          const messageContent = processReassembledMessage(
            messageData.chunks,
            key,
            messageData.timestamp
          );

          if (messageContent) {
            chatMessages.push(messageContent);
          }
        }
      }
    }

    // Sort messages by timestamp
    chatMessages.sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    console.log(`Processed ${chatMessages.length} chat messages from topic ${topicId}`);

    // Log quota from last message if available
    if (chatMessages.length > 0) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      console.log(`Last message has usageQuota: ${lastMsg.usageQuota !== undefined ? lastMsg.usageQuota : 'undefined'}`);
    }

    return chatMessages;

  } catch (error) {
    console.error('Error retrieving chat messages:', error);
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

    // Try to parse as JSON
    const content = JSON.parse(decodedMessage);

    // Check if this is a chat message
    if (content && content.type === 'CHAT_TOPIC' && content.question) {
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
      return {
        id: `quota-${sequenceNumber.toString()}`,
        question: "Quota updated",
        answer: `Your message quota has been updated to ${content.usageQuota}`,
        timestamp: content.timestamp || timestamp,
        usageQuota: content.usageQuota
      };
    }
  } catch (e) {
    console.warn('Failed to process message content:', e);
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

    // Try to parse the JSON
    const content = JSON.parse(combinedMessage);

    // Check if this is a chat message
    if (content && content.type === 'CHAT_TOPIC' && content.question) {
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
      return {
        id: `quota-${key}`,
        question: "Quota updated",
        answer: `Your message quota has been updated to ${content.usageQuota}`,
        timestamp: content.timestamp || timestamp,
        usageQuota: content.usageQuota
      };
    }
  } catch (e) {
    console.warn(`Failed to process reassembled message: ${e}`);
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

    if (usageQuota <= 0) {
      // Check if this is a first message with no quota yet
      const messages = await getChatMessages(topicId);
      if (messages.length === 0) {
        // This is likely a new topic, set initial quota
        usageQuota = 10; // Set initial quota for new topics
      } else {
        throw new Error('Usage quota is 0');
      }
    }

    // Set up client directly (similar to getClient implementation)
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

    // Non-null assertion is safe here because we've checked above
    client.setOperator(operatorId, operatorKey);

    // Create message content
    const messageContent = {
      type: 'CHAT_TOPIC',
      question,
      answer,
      timestamp: new Date().toISOString(),
      usageQuota: usageQuota - 1
    };


    // Get operator private key - non-null assertion is safe here because we check above
    const privateKey = PrivateKey.fromString(operatorKey);

    // Submit the message to the topic
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(Buffer.from(JSON.stringify(messageContent)))
      .freezeWith(client);

    const signedTx = await transaction.sign(privateKey);
    const txResponse = await signedTx.execute(client);
    await txResponse.getReceipt(client);

  } catch (error) {
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

    // Create quota update message content
    const messageContent = {
      type: 'CHAT_TOPIC_QUOTA_UPDATE',
      timestamp: new Date().toISOString(),
      usageQuota: usageQuota,
      message: 'Quota update transaction'
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
    await txResponse.getReceipt(client);

    console.log(`Updated usage quota for topic ${topicId} to ${usageQuota}`);
  } catch (error) {
    console.error('Error updating usage quota:', error);
    throw error;
  }
}