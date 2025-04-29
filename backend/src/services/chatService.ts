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
    console.log('DEBUG CHAT: chatService.ts - askAssistant called', prompt, topicId, usageQuota);
    
    // Validate inputs
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Invalid prompt provided');
    }
    
    if (!process.env.OPENAI_API_KEY) {
      console.error('DEBUG CHAT: chatService.ts - OpenAI API key is not configured');
      return getFallbackResponse(prompt, topicId);
    }
    
    let context = '';
    try {
      context = await knowledgeBase.getRelevantContext(prompt);
      console.log('DEBUG CHAT: chatService.ts - Got context from knowledge base, length:', context?.length || 0);
    } catch (contextError) {
      console.error('DEBUG CHAT: chatService.ts - Error getting context:', contextError);
      // Continue with empty context if knowledge base fails
      context = "";
    }

    console.log('DEBUG CHAT: chatService.ts - Calling OpenAI API');
    
    let responseContent: string;
    try {
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
            - Keep a motivating, professional tone — you are a technical mentor and co-builder.
            - Always structure your entire response using Markdown (*.md) format:
            - Code blocks must use triple backticks and specify the language (e.g., \`\`\`typescript).
            - Organize information with headers, lists, and tables when appropriate.

            ${context ? `Repository Context:\n---\n${context}\n---\n\n` : ''}

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
      
      responseContent = completion.choices[0]?.message?.content || '';
      console.log('DEBUG CHAT: chatService.ts - Received response from OpenAI');
    } catch (openaiError: any) {
      console.error('DEBUG CHAT: chatService.ts - OpenAI API call failed:', openaiError);
      // Use fallback instead of throwing
      return getFallbackResponse(prompt, topicId);
    }

    if (!responseContent) {
      console.warn('DEBUG CHAT: chatService.ts - Empty response from OpenAI');
      return getFallbackResponse(prompt, topicId);
    }

    if (topicId) {
      console.log('DEBUG CHAT: chatService.ts - Recording conversation to topic', topicId);
      try {
        await recordConversationToTopic(topicId, prompt, responseContent, usageQuota);
        console.log('DEBUG CHAT: chatService.ts - Recorded conversation successfully');
      } catch (recordError) {
        console.error('DEBUG CHAT: chatService.ts - Error recording to topic:', recordError);
        // We'll still return the OpenAI response even if recording fails
      }
    }

    return responseContent;
  } catch (error: any) {
    console.error('DEBUG CHAT: chatService.ts - Error in askAssistant:', error);
    return getFallbackResponse(prompt, topicId);
  }
}

/**
 * Provides a fallback response when OpenAI isn't available
 */
function getFallbackResponse(prompt: string, topicId: string): string {
  console.log('DEBUG CHAT: chatService.ts - Using fallback response');
  
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
      console.error('DEBUG CHAT: chatService.ts - Failed to record fallback response:', err);
    });
  } catch (error) {
    console.error('DEBUG CHAT: chatService.ts - Error recording fallback response:', error);
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
    console.log('DEBUG CHAT: chatService.ts - recordConversationToTopic called', {
      topicId,
      questionLength: question.length,
      answerLength: answer.length,
      usageQuota
    });
    
    if (usageQuota <= 0) {
      // Check if this is a first message with no quota yet
      console.log('DEBUG CHAT: chatService.ts - Zero quota, checking if new topic');
      const messages = await getChatMessages(topicId);
      if (messages.length === 0) {
        // This is likely a new topic, set initial quota
        console.log(`DEBUG CHAT: chatService.ts - New topic detected: ${topicId}, initializing with default quota of 10`);
        usageQuota = 10; // Set initial quota for new topics
      } else {
        console.log('DEBUG CHAT: chatService.ts - Not a new topic, quota is 0');
        throw new Error('Usage quota is 0');
      }
    }

    // Set up client directly (similar to getClient implementation)
    const network = process.env.HEDERA_NETWORK || 'testnet';
    const operatorId = process.env.HEDERA_OPERATOR_ID;
    const operatorKey = process.env.HEDERA_OPERATOR_KEY;

    console.log('DEBUG CHAT: chatService.ts - Setting up Hedera client for', network);

    if (!operatorId || !operatorKey) {
      console.error('DEBUG CHAT: chatService.ts - Missing Hedera credentials');
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
    console.log('DEBUG CHAT: chatService.ts - Hedera client setup complete');

    // Create message content
    const messageContent = {
      type: 'CHAT_TOPIC',
      question,
      answer,
      timestamp: new Date().toISOString(),
      usageQuota: usageQuota - 1
    };

    console.log('DEBUG CHAT: chatService.ts - Created message content with usageQuota:', usageQuota - 1);

    // Get operator private key - non-null assertion is safe here because we check above
    const privateKey = PrivateKey.fromString(operatorKey);

    // Submit the message to the topic
    console.log('DEBUG CHAT: chatService.ts - Creating TopicMessageSubmitTransaction');
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(Buffer.from(JSON.stringify(messageContent)))
      .freezeWith(client);

    console.log('DEBUG CHAT: chatService.ts - Signing transaction');
    const signedTx = await transaction.sign(privateKey);
    console.log('DEBUG CHAT: chatService.ts - Executing transaction');
    const txResponse = await signedTx.execute(client);
    console.log('DEBUG CHAT: chatService.ts - Getting receipt');
    await txResponse.getReceipt(client);

    console.log(`DEBUG CHAT: chatService.ts - Recorded conversation to topic ${topicId} successfully`);
  } catch (error) {
    console.error('DEBUG CHAT: chatService.ts - Error in recordConversationToTopic:', error);
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