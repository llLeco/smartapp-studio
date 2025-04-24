import OpenAI from 'openai';
import dotenv from 'dotenv';
import { TopicId, TopicMessageSubmitTransaction, PrivateKey } from "@hashgraph/sdk";
import { Client } from "@hashgraph/sdk";
import { getTopicMessages } from "./hederaService";

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
 * Interface para resposta de verificação de cota de mensagens
 */
export interface MessageAllowanceResponse {
  success: boolean;
  remainingMessages: number;
  totalAllowance: number;
  messagesUsed: number;
  error?: string;
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
    // Verificar se o tópico tem mensagens disponíveis
    if (topicId) {
      const allowanceData = await getMessagesAllowance(topicId);
      
      if (!allowanceData.success) {
        throw new Error(allowanceData.error || 'Failed to check message allowance');
      }
      
      if (allowanceData.remainingMessages <= 0) {
        return "Você atingiu o limite de mensagens disponíveis para este projeto. Por favor, adquira mais mensagens para continuar.";
      }
    }

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
    // Verificar e atualizar a contagem de mensagens
    const allowanceData = await getMessagesAllowance(topicId);
    
    if (!allowanceData.success) {
      throw new Error(allowanceData.error || 'Failed to check message allowance');
    }
    
    if (allowanceData.remainingMessages <= 0) {
      throw new Error('No message allowance remaining for this project');
    }
    
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
    
    // Atualizar a contagem de mensagens
    await updateMessagesUsage(topicId);
    
    console.log(`Recorded conversation to topic ${topicId}`);
  } catch (error) {
    console.error('Error recording conversation to topic:', error);
    throw error;
  }
}

/**
 * Obtém as informações de uso e permissões de mensagens para um tópico de projeto
 * @param projectTopicId O ID do tópico do projeto
 * @returns O número de mensagens restantes e dados de uso
 */
export async function getMessagesAllowance(projectTopicId: string): Promise<MessageAllowanceResponse> {
  try {
    // Buscar mensagens do tópico do projeto
    const messages = await getTopicMessages(projectTopicId);
    
    // Encontrar a mensagem de criação do projeto
    const creationMessage = messages.find(msg => 
      msg.content && (msg.content.type === 'PROJECT_CREATED' || msg.content.type === 'PROJECT_CREATION')
    );
    
    if (!creationMessage) {
      return {
        success: false,
        remainingMessages: 0,
        totalAllowance: 0,
        messagesUsed: 0,
        error: 'Project creation message not found'
      };
    }
    
    // Obter o número total de chats permitidos da mensagem de criação
    let chatCount = creationMessage.content.chatCount || 3; // Padrão para 3
    let messagesUsed = 0;
    
    // Procurar pela mensagem de atualização mais recente
    const updateMessages = messages.filter(msg => 
      msg.content && msg.content.type === 'MESSAGE_ALLOWANCE_UPDATE'
    );
    
    // Se houver mensagens de atualização, usar a mais recente para obter as informações
    if (updateMessages.length > 0) {
      // Ordenar por timestamp (mais recente primeiro)
      updateMessages.sort((a, b) => {
        return new Date(b.content.timestamp).getTime() - new Date(a.content.timestamp).getTime();
      });
      
      const latestUpdate = updateMessages[0].content;
      
      // Se a mensagem tiver as informações completas, usar diretamente
      if (latestUpdate.totalAllowance !== undefined && 
          (latestUpdate.messagesUsed !== undefined || latestUpdate.remainingMessages !== undefined)) {
        
        // Priorizar o valor explícito de totalAllowance
        chatCount = latestUpdate.totalAllowance;
        
        // Verificar se temos messagesUsed ou calculá-lo a partir de remainingMessages
        if (latestUpdate.messagesUsed !== undefined) {
          messagesUsed = latestUpdate.messagesUsed;
        } else if (latestUpdate.remainingMessages !== undefined) {
          messagesUsed = chatCount - latestUpdate.remainingMessages;
        }
        
        // Retornar diretamente os valores da última atualização
        return {
          success: true,
          remainingMessages: Math.max(0, chatCount - messagesUsed),
          totalAllowance: chatCount,
          messagesUsed
        };
      } else if (latestUpdate.newTotal !== undefined) {
        // Compatibilidade com o formato anterior que usava newTotal
        chatCount = latestUpdate.newTotal;
      }
    }
    
    // Se não encontramos uma mensagem de atualização com informações completas,
    // contar mensagens do tipo CHAT_TOPIC
    const chatMessages = messages.filter(msg => 
      msg.content && msg.content.type === 'CHAT_TOPIC'
    );
    
    messagesUsed = chatMessages.length;
    const remainingMessages = chatCount - messagesUsed;
    
    return {
      success: true,
      remainingMessages: remainingMessages > 0 ? remainingMessages : 0,
      totalAllowance: chatCount,
      messagesUsed
    };
  } catch (error: any) {
    console.error('Error getting messages allowance:', error);
    return {
      success: false,
      remainingMessages: 0,
      totalAllowance: 0,
      messagesUsed: 0,
      error: error.message || 'Failed to check message allowance'
    };
  }
}

/**
 * Atualiza o uso de mensagens em um tópico de projeto após uma nova mensagem
 * @param projectTopicId O ID do tópico do projeto
 * @returns Status da atualização
 */
export async function updateMessagesUsage(projectTopicId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Verificar se ainda há permissões disponíveis
    const allowance = await getMessagesAllowance(projectTopicId);
    
    if (!allowance.success) {
      return { success: false, error: allowance.error };
    }
    
    // Se não houver mais permissões, retornar erro
    if (allowance.remainingMessages <= 0) {
      return { 
        success: false, 
        error: 'No remaining message allowance for this project' 
      };
    }
    
    // Cria uma mensagem de atualização no tópico com as informações mais recentes
    // Setup do cliente Hedera
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
    
    client.setOperator(operatorId, operatorKey);
    
    // Cria o conteúdo da mensagem de atualização
    const messageContent = {
      type: 'MESSAGE_ALLOWANCE_UPDATE',
      totalAllowance: allowance.totalAllowance,
      messagesUsed: allowance.messagesUsed + 1, // Incrementa para incluir a mensagem que acabou de ser enviada
      remainingMessages: allowance.remainingMessages - 1, // Decrementa para refletir a mensagem atual
      timestamp: new Date().toISOString()
    };
    
    // Envia a mensagem para o tópico
    const privateKey = PrivateKey.fromString(operatorKey);
    
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(projectTopicId))
      .setMessage(Buffer.from(JSON.stringify(messageContent)))
      .freezeWith(client);
    
    const signedTx = await transaction.sign(privateKey);
    const txResponse = await signedTx.execute(client);
    await txResponse.getReceipt(client);
    
    console.log(`Updated message allowance for project ${projectTopicId}: ${allowance.remainingMessages - 1} messages remaining`);
    
    return { success: true };
  } catch (error: any) {
    console.error('Error updating messages usage:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to update message usage' 
    };
  }
}

/**
 * Adiciona mais mensagens a um projeto
 * @param projectTopicId O ID do tópico do projeto
 * @param additionalMessages Quantidade de mensagens a adicionar
 * @returns Status da operação
 */
export async function addMessagesToProject(
  projectTopicId: string,
  additionalMessages: number,
  paymentTransactionId?: string
): Promise<{
  success: boolean;
  newTotal?: number;
  error?: string;
}> {
  try {
    console.log(`Adding ${additionalMessages} messages to project ${projectTopicId}`);
    console.log(`Payment transaction ID: ${paymentTransactionId}`);
    // Verificar se o ID da transação foi fornecido
    if (!paymentTransactionId) {
      return { success: false, error: 'Payment transaction ID is required' };
    }
    
    // Verificar se a transação existe e é válida
    try {
      const network = process.env.HEDERA_NETWORK || 'testnet';
      const mirrorNodeUrl = {
        mainnet: "https://mainnet-public.mirrornode.hedera.com",
        testnet: "https://testnet.mirrornode.hedera.com",
        previewnet: "https://previewnet.mirrornode.hedera.com"
      };
      
      const baseUrl = mirrorNodeUrl[network as keyof typeof mirrorNodeUrl];
      
      // Extract account ID from the transaction ID
      const accountId = paymentTransactionId.split('@')[0];
      console.log(`Extracted account ID: ${accountId}`);
      
      // Format the transaction timestamp for filtering
      let timestamp = '';
      if (paymentTransactionId.includes('@')) {
        timestamp = paymentTransactionId.split('@')[1];
        console.log(`Extracted timestamp: ${timestamp}`);
      }
      
      // Instead of looking up by transaction ID, get recent transactions for the account
      // This is more reliable as the mirror node indexes by account more quickly
      const url = `${baseUrl}/api/v1/transactions?account.id=${accountId}&limit=10&order=desc`;
      console.log(`Checking account transactions on Mirror Node: ${url}`);
      
      const response = await fetch(url);
      console.log(`Response status: ${response.status}, OK: ${response.ok}`);

      if (!response.ok) {
        throw new Error(`Failed to query transactions: ${response.status}`);
      }
      
      const txData = await response.json();
      console.log(`Found ${txData.transactions?.length || 0} recent transactions for account ${accountId}`);
      
      // Look for our specific transaction using timestamp
      let found = false;
      if (txData.transactions && txData.transactions.length > 0) {
        // Format the transaction ID used in the response
        const transactionIdToFind = timestamp ? 
          `${accountId}-${timestamp.replace('.', '-')}` : 
          null;
          
        console.log(`Looking for transaction ID: ${transactionIdToFind}`);
        
        // Find matching transaction
        for (const tx of txData.transactions) {
          console.log(`Checking transaction: ${tx.transaction_id} vs ${transactionIdToFind}`);
          if (tx.transaction_id === transactionIdToFind || 
              (tx.token_transfers && tx.result === 'SUCCESS')) {
            console.log(`Found matching transaction: ${tx.transaction_id}, result: ${tx.result}`);
            found = true;
            
            if (tx.result !== 'SUCCESS') {
              return { success: false, error: `Transaction was not successful: ${tx.result}` };
            }
            
            console.log(`Verified payment transaction ${paymentTransactionId} successfully`);
            break;
          }
        }
      }
      
      if (!found) {
        // If we couldn't find the exact transaction, return error
        return { success: false, error: 'Transaction not found in recent account history' };
      }
      
    } catch (verifyError: any) {
      console.error('Error verifying transaction:', verifyError);
      return { success: false, error: `Failed to verify payment: ${verifyError.message}` };
    }
    
    // Primeiro, verificamos o status atual das mensagens
    const currentAllowance = await getMessagesAllowance(projectTopicId);
    
    if (!currentAllowance.success) {
      return { success: false, error: currentAllowance.error };
    }
    
    // Calcula o novo total
    const newTotal = currentAllowance.totalAllowance + additionalMessages;
    
    // Cria o conteúdo da mensagem
    const messageContent = {
      type: 'MESSAGE_ALLOWANCE_UPDATE',
      totalAllowance: newTotal,
      messagesUsed: currentAllowance.messagesUsed,
      remainingMessages: newTotal - currentAllowance.messagesUsed,
      additionalMessages, // mantido para compatibilidade
      previousTotal: currentAllowance.totalAllowance, // mantido para compatibilidade
      newTotal, // mantido para compatibilidade
      timestamp: new Date().toISOString(),
      paymentTransactionId
    };
    
    // Setup do cliente Hedera
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
    
    client.setOperator(operatorId, operatorKey);
    
    // Envia a mensagem para o tópico
    const privateKey = PrivateKey.fromString(operatorKey);
    
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(projectTopicId))
      .setMessage(Buffer.from(JSON.stringify(messageContent)))
      .freezeWith(client);
    
    const signedTx = await transaction.sign(privateKey);
    const txResponse = await signedTx.execute(client);
    await txResponse.getReceipt(client);
    
    console.log(`Added ${additionalMessages} messages to project ${projectTopicId}, new total: ${newTotal}`);
    
    return {
      success: true,
      newTotal
    };
  } catch (error: any) {
    console.error('Error adding messages to project:', error);
    return {
      success: false,
      error: error.message || 'Failed to add messages to project'
    };
  }
} 