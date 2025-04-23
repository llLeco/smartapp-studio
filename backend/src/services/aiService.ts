import OpenAI from 'openai';
import dotenv from 'dotenv';
import { TopicId, TopicMessageSubmitTransaction, PrivateKey } from "@hashgraph/sdk";
import { Client } from "@hashgraph/sdk";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Interface for chat messages retrieved from Hedera
 */
export interface ChatMessage {
  id: string;
  question: string;
  answer: string;
  timestamp: string;
}

/**
 * Asks the OpenAI assistant to generate SmartApp structure based on the prompt
 * and records both question and answer to a Hedera topic
 * @param prompt User's input describing the SmartApp
 * @param topicId Hedera topic ID to record the conversation
 * @returns Generated response from the assistant
 */
export async function askAssistant(prompt: string, topicId?: string): Promise<any> {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an AI assistant that helps developers create SmartApps using HbarSuite and SmartNodes technology without smart contracts. You can generate app structure, NFT schemas, and base code. Regularly reference the official documentation at https://docs.hsuite.finance/ and include relevant links and excerpts when providing guidance. Use specific components and features from the documentation to ensure accuracy and alignment with HbarSuite best practices. IMPORTANT: Always format your entire response using proper Markdown (*.md) formatting. Use markdown for all text formatting, code blocks, lists, tables, and links. For code, always use triple backticks with the appropriate language specified."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "gpt-3.5-turbo",
    });

    const responseContent = completion.choices[0].message.content;
    
    // If topicId is provided, record the conversation to Hedera
    if (topicId) {
      await recordConversationToTopic(topicId, prompt, responseContent || "No response generated");
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
    // Set up client directly (similar to getClient implementation)
    const network = process.env.HEDERA_NETWORK || 'testnet';
    
    // Mirror Node base URL
    const MIRROR_NODE_BASE_URL = {
      mainnet: "https://mainnet-public.mirrornode.hedera.com",
      testnet: "https://testnet.mirrornode.hedera.com",
      previewnet: "https://previewnet.mirrornode.hedera.com"
    };
    
    // Get appropriate base URL for current network
    const baseUrl = MIRROR_NODE_BASE_URL[network as keyof typeof MIRROR_NODE_BASE_URL] || MIRROR_NODE_BASE_URL.testnet;
    
    console.log(`Retrieving chat messages for topic ${topicId}`);
    
    // Query the Mirror Node for topic messages
    const url = `${baseUrl}/api/v1/topics/${topicId}/messages?limit=100&encoding=base64&order=asc`;
    console.log(`Querying Mirror Node at: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Mirror node error ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    console.log(`Retrieved ${data.messages?.length || 0} total messages from topic`);
    
    // Process and filter messages - only returning CHAT_TOPIC types
    const chatMessages: ChatMessage[] = [];
    
    // Store chunked messages for reassembly
    const messageChunks: { [key: string]: { chunks: string[], timestamps: string[] } } = {};
    
    // First pass: identify and group message chunks
    for (const msg of data.messages || []) {
      try {
        // Check if message has chunk_info
        if (msg.chunk_info) {
          const chunkInfo = msg.chunk_info;
          const initialTxId = chunkInfo.initial_transaction_id?.account_id || 'unknown';
          const chunkKey = `${initialTxId}-${chunkInfo.total}`;
          
          if (!messageChunks[chunkKey]) {
            messageChunks[chunkKey] = {
              chunks: new Array(chunkInfo.total).fill(''),
              timestamps: new Array(chunkInfo.total).fill('')
            };
          }
          
          // Store this chunk in the appropriate position (0-indexed array)
          messageChunks[chunkKey].chunks[chunkInfo.number - 1] = msg.message;
          messageChunks[chunkKey].timestamps[chunkInfo.number - 1] = msg.consensus_timestamp;
          console.log(`Found chunk ${chunkInfo.number}/${chunkInfo.total} for transaction ${chunkKey}`);
        } else {
          // Process non-chunked messages directly
          processMessage(msg.message, msg.sequence_number, msg.consensus_timestamp);
        }
      } catch (e) {
        console.warn('Error processing message or chunk:', e);
      }
    }
    
    // Second pass: reassemble and process chunked messages
    for (const [key, messageData] of Object.entries(messageChunks)) {
      try {
        // Check if we have all chunks
        if (!messageData.chunks.includes('')) {
          // First decode each chunk from base64 to string
          const decodedChunks = messageData.chunks.map(chunk => 
            Buffer.from(chunk, 'base64').toString()
          );
          
          // Combine all decoded chunks
          const combinedMessage = decodedChunks.join('');
          
          // Get the latest timestamp from the chunks
          const latestTimestamp = messageData.timestamps.reduce((latest, current) => 
            current > latest ? current : latest, ''
          );
          
          console.log(`Reassembled message (first 50 chars): ${combinedMessage.substring(0, 50)}`);
          
          // Now try to parse the combined message
          try {
            const content = JSON.parse(combinedMessage);
            
            // Check if this is a chat message
            if (content && content.type === 'CHAT_TOPIC' && content.question) {
              chatMessages.push({
                id: (parseInt(key.split('-')[0].split('.')[2]) || chatMessages.length + 1).toString(),
                question: content.question,
                answer: content.answer || "No answer available",
                timestamp: content.timestamp || latestTimestamp
              });
              console.log(`Added chat message from chunks: ${content.question.substring(0, 30)}...`);
            }
          } catch (parseError: any) {
            console.log(`Failed to parse reassembled message: ${parseError.message}`);
            
            // Try to extract JSON using regex if it contains our marker
            if (combinedMessage.includes('"type":"CHAT_TOPIC"')) {
              try {
                // Look for complete JSON object containing our type
                const match = combinedMessage.match(/\{[^]*"type":"CHAT_TOPIC"[^]*\}/);
                if (match) {
                  const extractedJson = match[0];
                  // Try to fix common JSON issues
                  const fixedJson = extractedJson
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r')
                    .replace(/\t/g, '\\t')
                    .replace(/\\"/g, '\\"')
                    .replace(/"/g, '"')
                    .replace(/'/g, "'");
                  
                  try {
                    const content = JSON.parse(fixedJson);
                    if (content && content.type === 'CHAT_TOPIC' && content.question) {
                      chatMessages.push({
                        id: (parseInt(key.split('-')[0].split('.')[2]) || chatMessages.length + 1).toString(),
                        question: content.question,
                        answer: content.answer || "No answer available",
                        timestamp: content.timestamp || latestTimestamp
                      });
                      console.log(`Added chat message using regex extraction: ${content.question.substring(0, 30)}...`);
                    }
                  } catch (e) {
                    console.log("Failed to parse extracted JSON:", e);
                  }
                }
              } catch (e) {
                console.log("Failed to extract JSON with regex:", e);
              }
            }
          }
        } else {
          console.log(`Incomplete chunks for message ${key}, missing some parts`);
        }
      } catch (e) {
        console.warn(`Error reassembling chunked message ${key}:`, e);
      }
    }
    
    function processMessage(base64Message: string, sequenceNumber: number, timestamp: string) {
      try {
        // Decode message from base64
        const decodedMessage = Buffer.from(base64Message, 'base64').toString();
        console.log(`Processing message (first 50 chars): ${decodedMessage.substring(0, 50)}`);
        
        // Try to parse as JSON
        let content;
        try {
          content = JSON.parse(decodedMessage);
        } catch (parseError: any) {
          console.log(`JSON parsing failed: ${parseError.message}`);
          return; // Skip if we couldn't parse JSON
        }
        
        // Check if this is a chat message
        if (content && content.type === 'CHAT_TOPIC' && content.question) {
          chatMessages.push({
            id: sequenceNumber.toString(),
            question: content.question,
            answer: content.answer || "No answer available",
            timestamp: content.timestamp || timestamp
          });
          console.log(`Added chat message: ${content.question.substring(0, 30)}...`);
        }
      } catch (e) {
        console.warn('Failed to process message content:', e);
      }
    }
    
    console.log(`Filtered to ${chatMessages.length} chat messages from topic ${topicId}`);
    return chatMessages;
    
  } catch (error) {
    console.error('Error retrieving chat messages:', error);
    throw error;
  }
}

/**
 * Records a conversation (question and answer) to a Hedera topic
 * @param topicId The Hedera topic ID
 * @param question The user's question
 * @param answer The AI's response
 * @returns Promise that resolves when the message is recorded
 */
async function recordConversationToTopic(topicId: string, question: string, answer: string): Promise<void> {
  try {
    // Set up client directly (similar to getClient implementation)
    const network = process.env.HEDERA_NETWORK || 'testnet';
    const operatorId = process.env.HEDERA_OPERATOR_ID;
    const operatorKey = process.env.HEDERA_OPERATOR_KEY;
    
    if (!operatorId || !operatorKey) {
      throw new Error('HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set in environment variables');
    }
    
    let client;
    switch(network) {
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
      timestamp: new Date().toISOString()
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