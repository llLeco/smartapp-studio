import OpenAI from 'openai';
import dotenv from 'dotenv';
import { TopicId, TopicMessageSubmitTransaction, PrivateKey } from "@hashgraph/sdk";
import { Client } from "@hashgraph/sdk";
import { getTopicMessages } from "./topicService";
import { getMirrorNodeUrl } from './hederaService';
import { KnowledgeBaseService } from './knowledgeBaseService';

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
 * and records both question and answer to a Hedera topic
 * @param prompt User's input describing the SmartApp
 * @param topicId Hedera topic ID to record the conversation
 * @returns Generated response from the assistant
 */
export async function askAssistant(prompt: string, topicId: string, usageQuota: number): Promise<any> {
  try {
    const context = await knowledgeBase.getRelevantContext(prompt);

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `
          You are a professional AI assistant specialized in helping developers build SmartApps using HbarSuite and SmartNodes technology — without traditional smart contracts.

          Always act as a co-pilot: your goal is to guide, scaffold, and accelerate development.

          Use these principles:

          - Prioritize direct, actionable, and practical answers.
          - When a prompt is vague, ask quick clarifying questions before proceeding.
          - Always suggest next actions or improvements after giving an answer.
          - If relevant, propose small architecture/design tips to improve the project.
          - Use and reference official documentation: https://docs.hsuite.finance/
          - When necessary, directly cite or embed snippets from the repository context provided below.
          - Keep a motivating, professional tone — you are a technical mentor and co-builder.
          - Always structure your entire response using Markdown (*.md) format:
          - Code blocks must use triple backticks and specify the language (e.g., \`\`\`typescript).
          - Organize information with headers, lists, and tables when appropriate.

          Repository Context:
          ---
          ${context}
          ---

          Be proactive: the goal is to help the developer not only "answer" but "build."

          If appropriate, offer to scaffold file structures, NFT schemas, HCS topics, or initial components.

          Focus on real code, clear examples, and practical advice.
          `
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "gpt-3.5-turbo",
    });

    const responseContent = completion.choices[0].message.content;

    if (topicId) {
      await recordConversationToTopic(topicId, prompt, responseContent || "No response generated", usageQuota);
    }

    return responseContent;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw new Error('Failed to get response from AI assistant');
  }
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
        console.log(`New topic detected: ${topicId}, initializing with default quota of 10`);
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

    console.log(`Recorded conversation to topic ${topicId}`);
  } catch (error) {
    console.error('Error recording conversation to topic:', error);
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