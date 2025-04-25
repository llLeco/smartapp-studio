// backend/services/hederaService.ts
import "dotenv/config";
import {
  Client,
  TokenMintTransaction,
  TransferTransaction,
  TokenId,
  Hbar,
  PrivateKey,
  AccountId,
  TopicId,
  TopicCreateTransaction,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenAssociateTransaction,
  TopicMessageSubmitTransaction,
  Transaction,
  TransactionId
} from "@hashgraph/sdk";

export interface NftMetadata {
  name: string;
  description: string;
  topicId?: string;
  creator?: string;
  createdAt?: string;
  type: string;
}

export interface LicenseInfo {
  tokenId: string;
  serialNumber: number;
  topicId: string;
  metadata: NftMetadata;
  ownerId: string;
}

export interface Message {
  consensusTimestamp: string;
  topicSequenceNumber: string;
  content: any;
  type: 'USAGE' | 'UPGRADE' | 'CHAT_TOPIC' | 'OTHER';
}

// Add network configuration
const MIRROR_NODE_BASE_URL = {
  mainnet: "https://mainnet-public.mirrornode.hedera.com",
  testnet: "https://testnet.mirrornode.hedera.com",
  previewnet: "https://previewnet.mirrornode.hedera.com"
};

// Helper to get current network base URL
const getMirrorNodeUrl = () => {
  const network = process.env.HEDERA_NETWORK || 'testnet';
  return MIRROR_NODE_BASE_URL[network as keyof typeof MIRROR_NODE_BASE_URL] || MIRROR_NODE_BASE_URL.testnet;
};

// Get Hedera client based on network
const getClient = () => {
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
  
  return client.setOperator(operatorId, operatorKey);
};

// Mirror Node queries
export const getAccountNFTs = async (accountId: string) => {
  const url = `${getMirrorNodeUrl()}/api/v1/accounts/${accountId}/nfts`;
  const response = await fetch(url);
  const data = await response.json();
  return data.nfts || [];
};

export const getTopicMessages = async (topicId: string): Promise<Message[]> => {
  const url = `${getMirrorNodeUrl()}/api/v1/topics/${topicId}/messages?limit=100`;
  const response = await fetch(url);
  const data = await response.json();

  return (data.messages || []).map((msg: any) => {
    let content: any;
    try {
      content = JSON.parse(Buffer.from(msg.message, 'base64').toString());
    } catch {
      content = {};
    }
    return {
      consensusTimestamp: msg.consensus_timestamp,
      topicSequenceNumber: msg.sequence_number,
      content,
      type: content.type || 'OTHER'
    };
  });
};

export const summarizeUsage = (messages: Message[]) => {
  let usage = 0;
  let limit = 100;

  for (const msg of messages) {
    if (msg.type === 'USAGE') usage++;
    if (msg.type === 'UPGRADE' && msg.content?.upgrade?.newLimits?.usageLimit) {
      limit = msg.content.upgrade.newLimits.usageLimit;
    }
  }

  return { totalUsage: usage, usageLimit: limit, remainingUsage: limit - usage };
};

/**
 * Retrieves the public key for a Hedera account from the Mirror Node API
 */
export const getAccountPublicKey = async (
  accountId: string,
  network: string = 'testnet'
): Promise<{ key: string; type: string }> => {
  if (!accountId.match(/^\d+\.\d+\.\d+$/)) {
    throw new Error('Invalid account ID format.');
  }
  if (!['mainnet','testnet','previewnet'].includes(network)) {
    throw new Error('Invalid network.');
  }
  const url = `https://${network}.mirrornode.hedera.com/api/v1/accounts/${accountId}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Mirror node error ${res.status}`);
  }
  const data = await res.json();
  const key = data?.key?.key;
  const type = data?.key?._type;
  if (!key) throw new Error('Public key not found');
  return { key, type };
};

/**
 * Mint a license NFT and transfer it to the user
 */
export const mintLicenseToUser = async (
  userAccountId: string
): Promise<{ serial: number }> => {
  // Configure operator client
  const client = Client.forTestnet().setOperator(
    process.env.HEDERA_OPERATOR_ID!,
    process.env.HEDERA_OPERATOR_KEY!
  );

  const operatorKey = PrivateKey.fromString(
    process.env.HEDERA_OPERATOR_KEY!
  );
  const tokenId = TokenId.fromString(
    process.env.LICENSE_TOKEN_ID!
  );

  // Mint NFT
  const mintTx = await new TokenMintTransaction()
    .setTokenId(tokenId)
    .setMetadata([new Uint8Array()]) // optional: set metadata
    .freezeWith(client);

  const signedMint = await mintTx.sign(operatorKey);
  const mintRes = await signedMint.execute(client);
  const receipt = await mintRes.getReceipt(client);
  const serial = receipt.serials![0].toNumber();

  // Transfer NFT from treasury to user
  const transferTx = await new TransferTransaction()
    .addNftTransfer(
      tokenId,
      receipt.serials![0],
      process.env.HEDERA_OPERATOR_ID!,
      userAccountId
    )
    .freezeWith(client);

  const signedTransfer = await transferTx.sign(operatorKey);
  await signedTransfer.execute(client).then(r => r.getReceipt(client));

  return { serial };
};

export const getUserLicense = async (accountId: string) => {
  if (!process.env.LICENSE_TOKEN_ID) {
    throw new Error('LICENSE_TOKEN_ID environment variable is not set');
  }

  // Query directly for license NFTs using the tokenId parameter in the Mirror Node API
  const tokenId = process.env.LICENSE_TOKEN_ID;
  const limit = 100; // Set a reasonable limit
  const baseUrl = getMirrorNodeUrl();
  let url = `${baseUrl}/api/v1/accounts/${accountId}/nfts?token.id=${tokenId}&limit=${limit}`;
  
  try {
    // Handle pagination for complete results
    let allNfts: any[] = [];
    let hasMore = true;
    
    while (hasMore) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Mirror node error: ${response.status}`);
      }
      
      const data = await response.json();
      const nfts = data.nfts || [];
      allNfts = [...allNfts, ...nfts];
      
      // Check for more pages
      const nextLink = data.links?.next;
      if (nextLink) {
        url = `${baseUrl}${nextLink}`;
      } else {
        hasMore = false;
      }
    }
    
    if (!allNfts.length) {
      return null; // No license NFTs found
    }
    
    // Get the first license NFT (could be extended to handle multiple licenses)
    const license = allNfts[0];
    
    let topicId;
    try {
      // Try to decode the metadata as base64
      topicId = Buffer.from(license.metadata, 'base64').toString();
      // Validate if it's a valid topicId format
      TopicId.fromString(topicId); // Will throw if invalid
    } catch (e) {
      console.error('Failed to decode license metadata:', e);
      return {
        tokenId: license.token_id,
        serialNumber: license.serial_number,
        ownerId: accountId,
        valid: false,
        error: 'Invalid license metadata'
      };
    }
    
    // Get messages from the topic to verify license details
    const messages = await getTopicMessages(topicId);
    const usageInfo = summarizeUsage(messages);
    
    // Find the license creation message (should be first message)
    const creationMessage = messages.find(msg => 
      msg.content && msg.content.type === 'LICENSE_CREATION'
    );
    
    // Extract metadata from creation message if available
    const metadata = creationMessage?.content?.metadata || { 
      type: "LICENSE", 
      name: "License NFT", 
      description: "Hedera License NFT" 
    };
    
    return {
      tokenId: license.token_id,
      serialNumber: license.serial_number,
      topicId,
      metadata,
      ownerId: accountId,
      usageInfo,
      valid: usageInfo.remainingUsage > 0
    };
  } catch (e) {
    console.error('Error fetching license details:', e);
    return {
      tokenId: process.env.LICENSE_TOKEN_ID,
      ownerId: accountId,
      valid: false,
      error: e instanceof Error ? e.message : 'Unknown error'
    };
  }
}

/**
 * Creates a new topic on Hedera Consensus Service for license tracking
 */
export const createTopic = async (metadata: NftMetadata): Promise<string> => {
  try {
    const client = getClient();
    const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY!);
    
    // Create a new topic with memo containing license metadata
    const metadataStr = JSON.stringify({ type: 'LICENSE_METADATA', metadata });
    const transaction = new TopicCreateTransaction()
      .setAdminKey(operatorKey)
      .setSubmitKey(operatorKey)
      .setTopicMemo("License Main Topic - " + metadata.creator)
      .freezeWith(client);
    
    const signedTx = await transaction.sign(operatorKey);
    const txResponse = await signedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    const topicId = receipt.topicId!.toString();
    console.log(`Created topic with ID: ${topicId}`);
    
    return topicId;
  } catch (error) {
    console.error('Error creating topic:', error);
    throw error;
  }
}

/**
 * Creates a new NFT token on Hedera for license tokens
 */
export const createToken = async (topicId: string): Promise<string> => {
  try {
    const client = getClient();
    const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY!);
    const operatorId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID!);
    
    // Create a non-fungible token with the required settings
    const transaction = new TokenCreateTransaction()
      .setTokenName(`License Token for ${topicId}`)
      .setTokenSymbol("LICENSE")
      .setTokenType(TokenType.NonFungibleUnique)
      .setDecimals(0)
      .setInitialSupply(0)
      .setSupplyType(TokenSupplyType.Finite)
      .setMaxSupply(1000)
      .setTreasuryAccountId(operatorId)
      .setAdminKey(operatorKey)
      .setSupplyKey(operatorKey)
      .freezeWith(client);
    
    const signedTx = await transaction.sign(operatorKey);
    const txResponse = await signedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    const tokenId = receipt.tokenId!.toString();
    console.log(`Created token with ID: ${tokenId}`);
    
    return tokenId;
  } catch (error) {
    console.error('Error creating token:', error);
    throw error;
  }
}

/**
 * Mints a new NFT token for a license
 */
export const mintToken = async (tokenId: string, topicId: string): Promise<number> => {
  try {
    const client = getClient();
    const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY!);
    
    // Create topicId metadata bytes - this is used to link the NFT to its topic
    const metadataBytes = Buffer.from(topicId);
    
    // Mint the NFT with the topicId as metadata
    const transaction = new TokenMintTransaction()
      .setTokenId(TokenId.fromString(tokenId))
      .setMetadata([metadataBytes])
      .freezeWith(client);
    
    const signedTx = await transaction.sign(operatorKey);
    const txResponse = await signedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    const serialNumber = receipt.serials![0].toNumber();
    console.log(`Minted NFT with serial number: ${serialNumber}`);
    
    return serialNumber;
  } catch (error) {
    console.error('Error minting token:', error);
    throw error;
  }
}

/**
 * Records a license creation message on the topic
 */
export const recordMessage = async (
  topicId: string, 
  tokenId: string, 
  serialNumber: number, 
  metadata: NftMetadata
): Promise<string> => {
  try {
    const client = getClient();
    const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY!);
    
    // Create a message that documents the license creation
    const message = {
      type: 'LICENSE_CREATION',
      tokenId,
      serialNumber,
      metadata,
      timestamp: new Date().toISOString()
    };
    
    // Convert the message to a string and then to bytes
    const messageBytes = Buffer.from(JSON.stringify(message));
    
    // Submit the message to the topic
    const transaction = await new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(messageBytes)
      .freezeWith(client);
    
    const signedTx = await transaction.sign(operatorKey);
    const txResponse = await signedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    // Get the message timestamp
    const messageTimestamp = new Date().toISOString();
    console.log(`Recorded message to topic ${topicId} at ${messageTimestamp}`);
    
    return messageTimestamp;
  } catch (error) {
    console.error('Error recording message:', error);
    throw error;
  }
}

/**
 * Transfers an NFT license token from one account to another
 * 
 * @param tokenId - The ID of the token being transferred
 * @param serialNumber - The serial number of the specific NFT
 * @param senderId - The account ID of the sender
 * @param recipientId - The account ID of the recipient
 * @returns Object containing transfer details and status
 */
export const transferLicense = async (tokenId: string, serialNumber: number, senderId: string, recipientId: string) => {
  try {
    const client = getClient();
    const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY!);
    
    // Create a transfer transaction
    const transaction = new TransferTransaction()
      .addNftTransfer(
        TokenId.fromString(tokenId),
        serialNumber,
        AccountId.fromString(senderId),
        AccountId.fromString(recipientId)
      )
      .freezeWith(client);
    
    // Sign the transaction with the operator key
    const signedTx = await transaction.sign(operatorKey);
    const txResponse = await signedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    return {
      status: receipt.status.toString(),
      tokenId,
      serialNumber,
      from: senderId,
      to: recipientId,
      transactionId: txResponse.transactionId.toString()
    };
  } catch (error) {
    console.error('Error transferring license:', error);
    throw error;
  }
}

/**
 * Gets the operator ID from environment variables
 */
export const getOperatorId = (): string | null => {
  const operatorId = process.env.HEDERA_OPERATOR_ID;
  if (!operatorId) {
    console.warn('HEDERA_OPERATOR_ID environment variable is not set');
    return null;
  }
  return operatorId;
}

/**
 * Executes a transaction that has been signed by the client
 */
export const executeSignedTransaction = async (
  signedTransactionBytes: Uint8Array
): Promise<{ status: string; transactionId: string }> => {
  try {
    const client = getClient();
    
    // Convert the signed transaction bytes back to a transaction object
    const transaction = Transaction.fromBytes(signedTransactionBytes);
    
    // Execute the transaction
    const txResponse = await transaction.execute(client);
    const receipt = await txResponse.getReceipt(client);
    
    // Get the transaction ID as string, falling back to a timestamp if not available
    const transactionId = transaction.transactionId 
      ? transaction.transactionId.toString() 
      : `transaction-${new Date().toISOString()}`;
    
    return {
      status: receipt.status.toString(),
      transactionId
    };
  } catch (error) {
    console.error('Error executing signed transaction:', error);
    throw error;
  }
}

/**
 * Gets the license token ID from environment variables
 */
export const getLicenseTokenId = (): string | null => {
  const tokenId = process.env.LICENSE_TOKEN_ID;
  if (!tokenId) {
    console.warn('LICENSE_TOKEN_ID environment variable is not set');
    return null;
  }
  return tokenId;
}

/**
 * Creates a new topic for a project
 */
export const createProjectTopic = async (projectName: string, ownerAccountId?: string, chatCount: number = 3): Promise<string> => {
  try {
    const client = getClient();
    
    const adminKey = client.operatorPublicKey;
    const submitKey = client.operatorPublicKey;
    
    // Create a new topic with transaction
    const transaction = new TopicCreateTransaction();
    
    // Only set keys if they exist
    if (adminKey) {
      transaction.setAdminKey(adminKey);
    }
    
    if (submitKey) {
      transaction.setSubmitKey(submitKey);
    }
    
    transaction.setTopicMemo(`Project: ${projectName}`);
    
    const txResponse = await transaction.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const topicId = receipt.topicId!.toString();
    
    console.log(`Created new project topic ${topicId} for ${projectName} with ${chatCount} chat messages`);
    
    // Submit initial message to the topic with message allowance information
    const messageContent = {
      type: 'PROJECT_CREATION',
      name: projectName,
      createdAt: new Date().toISOString(),
      owner: ownerAccountId || client.operatorAccountId!.toString(),
      chatCount: chatCount,
    };
    
    const message = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(Buffer.from(JSON.stringify(messageContent)));
      
    await message.execute(client);
    
    return topicId;
  } catch (error) {
    console.error('Error creating project topic:', error);
    throw error;
  }
};

/**
 * Records a project reference in the license topic
 */
export const recordProjectToLicense = async (
  licenseTopicId: string,
  projectTopicId: string,
  accountId: string,
  projectName: string,
  timestamp: string,
  chatCount?: number
): Promise<string> => {
  try {
    const client = getClient();
    
    // Create the message to send
    const messageContent = {
      type: 'PROJECT_CREATED',
      projectTopicId,
      projectName,
      ownerAccountId: accountId,
      chatCount: chatCount || 3, // Usar chatCount se fornecido, ou 3 como padrão
      createdAt: timestamp || new Date().toISOString()
    };
    
    // Submit the message to the topic
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(licenseTopicId)
      .setMessage(Buffer.from(JSON.stringify(messageContent)));
      
    const response = await transaction.execute(client);
    const receipt = await response.getReceipt(client);
    
    console.log(`Recorded project ${projectTopicId} in license ${licenseTopicId} with ${chatCount || 3} chats`);
    
    // Return the transaction ID as a record of the message
    return response.transactionId.toString();
  } catch (error) {
    console.error('Error recording project to license:', error);
    throw error;
  }
};
