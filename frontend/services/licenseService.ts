import { 
  Client,
  AccountId,
  Hbar, 
  TokenAssociateTransaction,
  Transaction,
  TransactionId,
  TokenId,
  TransferTransaction
} from "@hashgraph/sdk";
import getDAppConnector from "../lib/walletConnect";
import type { DAppSigner } from "@hashgraph/hedera-wallet-connect";
import { createTopic } from "./topicService";
import { getTokenDetails } from "./hederaService";

// --- Types ---
export interface NftMetadata {
  name: string;
  description: string;
  topicId?: string;
  creator?: string;
  createdAt?: string;
  type: string;
}

export interface NftInfo {
  tokenId: string;
  serialNumber: number;
  topicId: string;
  metadata: NftMetadata;
}

// Mirror Node URL
const MIRROR_NODE_URL = process.env.NEXT_PUBLIC_MIRROR_NODE_URL || "https://testnet.mirrornode.hedera.com";

// Create a client for transaction preparation
function getClient() {
  // For testnet
  return Client.forTestnet();
  
  // For mainnet, uncomment this:
  // return Client.forMainnet();
}

// --- Helpers ---
async function getSigner(): Promise<DAppSigner> {
  const connector = await getDAppConnector(false);
  if (!connector?.signers?.length) {
    const fresh = await getDAppConnector(true);
    if (!fresh?.signers?.length)
      throw new Error("Please reconnect your wallet.");
    return fresh.signers[0];
  }
  return connector.signers[0];
}

async function freezeAndSign<T extends Transaction>(
  tx: T,
  signer: DAppSigner,
  client: Client
): Promise<T> {
  try {
    if (!tx.transactionId) {
      tx.setTransactionId(TransactionId.generate(AccountId.fromString(signer.accountId.toString())));
    }

    tx.setNodeAccountIds([new AccountId(3)]);

    const frozenTx = await tx.freezeWith(client);
    
    if (typeof signer.signTransaction === 'function' &&
      signer.signTransaction.length === 1 &&
      signer.signTransaction.toString().includes('transaction')) {
      return await signer.signTransaction(frozenTx);
    } else {
      throw new Error('This wallet does not support the required transaction signing method');
    }
  } catch (error) {
    console.error('Error in freezeAndSign:', error);
    throw new Error('Failed to sign transaction. Please check your wallet connection.');
  }
}

/**
 * Checks if an account has a token associated using Mirror Node directly
 */
async function isTokenAssociated(accountId: string, tokenId: string): Promise<boolean> {
  try {
    const url = `${MIRROR_NODE_URL}/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Mirror node error: ${response.status}`);
    }
    
    const data = await response.json();
    // If tokens array has any entries, the account is associated with the token
    return (data.tokens && data.tokens.length > 0);
  } catch (error) {
    console.error('Error checking token association:', error);
    throw error;
  }
}

/**
 * Prepares metadata and gets account ID for license creation
 */
export async function prepareMetadata(
  metadata: NftMetadata
): Promise<{ accountId: string; fullMetadata: NftMetadata }> {
  const signer = await getSigner();
  const accountId = signer.accountId.toString();

  const fullMetadata: NftMetadata = {
    ...metadata,
    createdAt: new Date().toISOString(),
    creator: accountId,
    type: "LICENSE",
  };

  return { accountId, fullMetadata };
}

/**
 * Creates a license topic and retrieves token ID
 */
export async function createLicenseTopic(
  metadata: NftMetadata
): Promise<{ topicId: string; tokenId: string } | { error: string }> {
  try {
    console.log(`Creating new topic with metadata: ${JSON.stringify(metadata)}`);
    const topicId = await createTopic(metadata);
    console.log(`Created topic with ID: ${topicId}`);

    const licenseTokenIdRes = await fetch('/api/hedera?type=licensetokenid');
    const licenseTokenIdData = await licenseTokenIdRes.json();
    
    console.log(`License token ID response:`, licenseTokenIdData);
    
    if (!licenseTokenIdData.success) {
      throw new Error(licenseTokenIdData.error || "Failed to get license token ID");
    }
    
    // Try to get tokenId from different possible locations in the response
    let tokenId = licenseTokenIdData.data;
    
    // If data doesn't exist, try tokenId directly
    if (!tokenId && licenseTokenIdData.tokenId) {
      tokenId = licenseTokenIdData.tokenId;
    }
    
    if (!tokenId) {
      console.error("License token ID response structure:", licenseTokenIdData);
      throw new Error("License token ID is empty or in unexpected format");
    }
    
    console.log(`Retrieved license token ID: ${tokenId}`);
    return { topicId, tokenId };
  } catch (e: any) {
    console.error("Error in createLicenseTopic:", e);
    return { error: e.message };
  }
}

/**
 * Mints a license token
 */
export async function mintLicenseToken(
  tokenId: string,
  topicId: string
): Promise<{ serialNumber: number } | { error: string }> {
  try {
    console.log(`Minting token with tokenId: ${tokenId}, topicId: ${topicId}`);
    const res = await fetch("/api/license?action=mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId, topicId }),
    });
    
    if (!res.ok) {
      console.error(`Mint token API returned status: ${res.status}`);
      return { error: `API error: ${res.status}` };
    }
    
    const responseData = await res.json();
    console.log('Mint token response:', responseData);
    
    // Try to extract serialNumber from multiple possible response structures
    let serialNumber;
    
    if (responseData.data) {
      serialNumber = responseData.data;
    } else if (responseData.serialNumber) {
      serialNumber = responseData.serialNumber;
    } else if (typeof responseData === 'number') {
      serialNumber = responseData;
    }
    
    if (serialNumber === undefined || serialNumber === null) {
      console.error('Serial number not found in response:', responseData);
      return { error: 'Serial number not found in response' };
    }
    
    console.log(`Successfully minted token with serial number: ${serialNumber}`);
    return { serialNumber };
  } catch (e: any) {
    console.error('Error in mintLicenseToken:', e);
    return { error: e.message };
  }
}

/**
 * Associates a license token with an account
 */
export async function associateLicenseToken(
  accountId: string
): Promise<{ success: boolean } | { error: string }> {
  try {
    //get license token id from backend
    const licenseTokenIdRes = await fetch('/api/hedera?type=licensetokenid');
    const licenseTokenIdData = await licenseTokenIdRes.json();
    const licenseTokenId = licenseTokenIdData.tokenId;

    if (!accountId || !licenseTokenId) {
      throw new Error("Missing required data for token association");
    }

    const alreadyAssociated = await isTokenAssociated(accountId, licenseTokenId);
    if (alreadyAssociated) {
      console.log("Token already associated, skipping association");
      return { success: true };
    }

    console.log(`Associating token ${licenseTokenId} with ${accountId} via WalletConnect`);

    const signer = await getSigner();
    const client = getClient();
    
    const transaction = new TokenAssociateTransaction()
      .setAccountId(accountId)
      .setTokenIds([licenseTokenId])
      .setMaxTransactionFee(new Hbar(1));

    const signedTokenTx = await freezeAndSign(transaction, signer, client);
    const tokenReceipt = await (await signedTokenTx.execute(client)).getReceipt(client);
    
    console.log("✅ Token associated successfully");
    return { success: true };
  } catch (err: any) {
    // handle already‑associated error gracefully
    if (err.message && err.message.includes("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT") || 
        err.message && err.message.includes("ALREADY_ASSOCIATED")) {
      console.log("Token already associated, continuing to next step");
      return { success: true };
    }
    console.error("Error in associateLicenseToken:", err);
    return { error: err.message };
  }
}

/**
 * Records a license creation message
 */
export async function recordLicenseMessage(
  topicId: string,
  tokenId: string,
  serialNumber: number,
  metadata: NftMetadata
): Promise<{ messageTimestamp: string } | { error: string }> {
  try {
    console.log(`Recording license message for topicId: ${topicId}, tokenId: ${tokenId}, serialNumber: ${serialNumber}`);
    
    // Validate serial number is a number
    if (isNaN(Number(serialNumber))) {
      console.error(`Invalid serial number: ${serialNumber}`);
      // Use a fallback value of 1 if invalid
      serialNumber = 1;
      console.log(`Using fallback serial number: ${serialNumber}`);
    }
    
    const res = await fetch("/api/license?action=record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topicId,
        tokenId,
        serialNumber,
        metadata,
      }),
    });
    
    if (!res.ok) {
      console.error(`Record license message API returned status: ${res.status}`);
      return { error: `API error: ${res.status}` };
    }
    
    const responseData = await res.json();
    console.log('Record license message response:', responseData);
    
    if (!responseData.data && !responseData.messageTimestamp) {
      console.error('Message timestamp not found in response:', responseData);
      return { error: 'Message timestamp not found in response' };
    }
    
    const messageTimestamp = responseData.data || responseData.messageTimestamp;
    console.log(`Successfully recorded license message with timestamp: ${messageTimestamp}`);
    
    return { messageTimestamp };
  } catch (e: any) {
    console.error('Error in recordLicenseMessage:', e);
    return { error: e.message };
  }
}

/**
 * Transfers a license token to the user
 */
export async function transferLicenseToken(
  tokenId: string,
  serialNumber: number,
  accountId: string
): Promise<{ status: string } | { error: string }> {
  try {
    console.log(`Transferring license token: tokenId=${tokenId}, serialNumber=${serialNumber}, to accountId=${accountId}`);
    
    if (!accountId || !tokenId) {
      throw new Error("Missing required data for transfer");
    }
    
    // Validate serial number is a number
    if (isNaN(Number(serialNumber))) {
      console.error(`Invalid serial number: ${serialNumber}`);
      // Use a fallback value of 1 if invalid
      serialNumber = 1;
      console.log(`Using fallback serial number: ${serialNumber}`);
    }

    // Get the operator ID from backend for treasury account
    const operatorRes = await fetch('/api/hedera?type=network');
    const operatorData = await operatorRes.json();

    if (!operatorData.success || !operatorData.operatorId) {
      throw new Error('Operator ID not available');
    }
    
    let operatorId = operatorData.operatorId;
    
    console.log(`Using operator ID: ${operatorId} for transfer`);

    // Call the backend transferLicense endpoint
    const res = await fetch("/api/license?action=transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokenId,
        serialNumber,
        senderId: operatorId,
        recipientId: accountId
      }),
    });
    
    // Check for server errors
    if (!res.ok) {
      console.error(`Transfer license API returned status: ${res.status}`);
      try {
        const errorResponse = await res.json();
        console.error('Transfer error response:', errorResponse);
        
        // Even if the transfer fails, verify if the user already has the token
        console.log("Verifying token ownership through mirror node...");
        const ownershipResult = await verifyTokenOwnership(accountId, tokenId, serialNumber);
        
        if (ownershipResult.owned) {
          console.log("User already owns this token according to mirror node");
          return { status: "already_owned" };
        }
        
        return { error: `API error: ${res.status} - ${errorResponse.error || 'Unknown error'}` };
      } catch (parseError) {
        return { error: `API error: ${res.status}` };
      }
    }
    
    const responseData = await res.json();
    console.log('Transfer license response:', responseData);
    
    const { success, data, error } = responseData;
    
    if (!success) {
      console.error('Transfer license failed:', error || 'Unknown error');
      
      // Even if the API reports failure, verify if the user already has the token
      console.log("Verifying token ownership after reported failure...");
      const ownershipResult = await verifyTokenOwnership(accountId, tokenId, serialNumber);
      
      if (ownershipResult.owned) {
        console.log("User already owns this token according to mirror node");
        return { status: "already_owned" };
      }
      
      throw new Error(error || "License transfer failed");
    }

    console.log(`Successfully transferred license with status: ${data.status}`);
    return { status: data.status };
  } catch (e: any) {
    console.error('Error in transferLicenseToken:', e);
    return { error: e.message };
  }
}

/**
 * Verify if a user owns a specific token using mirror node
 */
async function verifyTokenOwnership(
  accountId: string, 
  tokenId: string, 
  serialNumber: number
): Promise<{ owned: boolean }> {
  try {
    console.log(`Verifying token ownership: accountId=${accountId}, tokenId=${tokenId}, serialNumber=${serialNumber}`);
    
    // Clean up the accountId format if needed (ensure it's in 0.0.XXXXX format)
    const cleanAccountId = accountId.includes('.') ? accountId : `0.0.${accountId}`;
    
    // Query the mirror node API to check if the account has this token
    const url = `${MIRROR_NODE_URL}/api/v1/accounts/${cleanAccountId}/tokens?token.id=${tokenId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Mirror node error: ${response.status}`);
      return { owned: false };
    }
    
    const data = await response.json();
    console.log('Token ownership data:', data);
    
    // Check if the token is in the list
    if (data.tokens && data.tokens.length > 0) {
      // Find the specific token
      const token = data.tokens.find((t: any) => t.token_id === tokenId);
      if (token) {
        console.log(`User owns token ${tokenId}`);
        return { owned: true };
      }
    }
    
    // As a fallback, try to check NFT info directly
    try {
      const nftUrl = `${MIRROR_NODE_URL}/api/v1/tokens/${tokenId}/nfts/${serialNumber}`;
      const nftResponse = await fetch(nftUrl);
      
      if (nftResponse.ok) {
        const nftData = await nftResponse.json();
        console.log('NFT ownership data:', nftData);
        
        if (nftData.account_id === cleanAccountId) {
          console.log(`NFT ${tokenId}:${serialNumber} is owned by ${cleanAccountId}`);
          return { owned: true };
        }
      }
    } catch (nftError) {
      console.error('Error checking NFT ownership:', nftError);
    }
    
    console.log(`User does not own token ${tokenId} or NFT ${serialNumber}`);
    return { owned: false };
  } catch (error) {
    console.error('Error verifying token ownership:', error);
    return { owned: false };
  }
}

// convenience: all‑in‑one flow for license creation
export async function createLicenseNft(
  metadata: NftMetadata
): Promise<NftInfo> {
  // Step 1: Prepare metadata and get account ID
  const { accountId, fullMetadata } = await prepareMetadata(metadata);

  console.log(`Account ID: ${accountId}`);
  console.log(`Full metadata: ${JSON.stringify(fullMetadata)}`);
  
  // Step 2: Create license topic
  const topicResult = await createLicenseTopic(fullMetadata);
  if ('error' in topicResult) throw new Error(topicResult.error);
  const { topicId, tokenId } = topicResult;
  
  // Step 3: Mint license token
  const mintResult = await mintLicenseToken(tokenId, topicId);
  if ('error' in mintResult) throw new Error(mintResult.error);
  const { serialNumber } = mintResult;
  
  // Step 4: Associate license token
  const associateResult = await associateLicenseToken(accountId);
  if ('error' in associateResult) throw new Error(associateResult.error);
  
  // Step 5: Record license message
  const messageResult = await recordLicenseMessage(topicId, tokenId, serialNumber, fullMetadata);
  if ('error' in messageResult) throw new Error(messageResult.error);
  
  // Step 6: Transfer license token
  const transferResult = await transferLicenseToken(tokenId, serialNumber, accountId);
  if ('error' in transferResult) throw new Error(transferResult.error);
  
  return {
    tokenId,
    serialNumber,
    topicId,
    metadata: fullMetadata,
  };
}

// check validity now via a single backend call
export async function getUserLicense(accountId: string) {
  try {
    console.log(`Checking license for account ID: ${accountId}`);
    const res = await fetch(`/api/license?accountId=${accountId}`);
    
    if (!res.ok) {
      console.error(`License API returned status: ${res.status}`);
      return null;
    }
    
    const responseData = await res.json();
    console.log('License check response:', responseData);
    
    const { success, license, error } = responseData;
    
    if (!success || !license) {
      console.log('No valid license found:', error || 'User has no license');
      return null;
    }
    
    console.log('Valid license found:', license);
    return license;
  } catch (e) {
    console.error('Error checking license validity:', e);
    return null;
  }
}

// --- Project Management ---
export const createNewProject = async (
  licenseTopicId: string,
  accountId: string,
  projectName: string,
  usageQuota: number = 3
): Promise<{ success: boolean; projectTopicId?: string; error?: string }> => {
  try {
    // Primeiro, crie o tópico do projeto
    const createResponse = await fetch('/api/hedera/createProjectTopic', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectName,
        ownerAccountId: accountId,
        usageQuota
      }),
    });

    const topicResult = await createResponse.json();
    
    if (!topicResult.success || !topicResult.data) {
      throw new Error(topicResult.error || 'Failed to create project topic');
    }
    
    const projectTopicId = topicResult.data;
    
    // Em seguida, registre o projeto no tópico da licença
    const recordResponse = await fetch('/api/hedera/recordProjectMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        licenseTopic: licenseTopicId,
        projectTopicId,
        accountId,
        projectName,
        usageQuota,
        timestamp: new Date().toISOString()
      }),
    });
    
    const recordResult = await recordResponse.json();
    
    if (!recordResult.success) {
      throw new Error(recordResult.error || 'Failed to record project message');
    }
    
    console.log(`Project created with ${usageQuota} chat messages`);
    
    return { 
      success: true, 
      projectTopicId
    };
  } catch (error: any) {
    console.error('Error creating new project:', error);
    return { success: false, error: error.message || 'Error creating new project' };
  }
};

// --- Project Retrieval ---
export interface Project {
  projectTopicId: string;
  projectName: string;
  createdAt: string;
  ownerAccountId: string;
}

/**
 * Creates a token transfer transaction for paying for a project
 * 
 * @param tokenId - The token ID to transfer
 * @param amount - The amount of tokens to transfer
 * @param senderAccountId - The account ID of the sender
 * @param receiverAccountId - The account ID of the receiver
 * @returns The transaction ready to be signed
 */
export async function createPaymentTransaction(
  tokenId: string,
  amount: number,
  senderAccountId: string,
  receiverAccountId: string
): Promise<Transaction> {
  try {
    // Log transaction details
    console.log(`Creating payment transaction with tokenId: ${tokenId}, amount: ${amount}, sender: ${senderAccountId}, receiver: ${receiverAccountId}`);

    // Create a client for transaction preparation
    const client = getClient();
    
    // Create a transfer transaction
    const transaction = new TransferTransaction()
      .addTokenTransfer(
        TokenId.fromString(tokenId),
        AccountId.fromString(senderAccountId),
        -amount
      )
      .addTokenTransfer(
        TokenId.fromString(tokenId),
        AccountId.fromString(receiverAccountId),
        amount
      )
      .setTransactionId(TransactionId.generate(AccountId.fromString(senderAccountId)))
      .setNodeAccountIds([new AccountId(3)]) // Use node 0.0.3 for testnet
      .freezeWith(client);
    
    return transaction;
  } catch (error: any) {
    console.error('Error creating payment transaction:', error);
    throw new Error('Failed to create payment transaction: ' + error.message);
  }
}

/**
 * Creates a token transfer transaction for paying for additional messages
 * 
 * @param tokenId - The token ID to transfer
 * @param messageCount - Number of messages to purchase
 * @param senderAccountId - The account ID of the sender
 * @param receiverAccountId - The account ID of the receiver
 * @returns The transaction ready to be signed
 */
export async function createMessagePaymentTransaction(
  tokenId: string,
  messageCount: number,
  senderAccountId: string,
  receiverAccountId: string
): Promise<Transaction> {
  try {
    // Set price per message from environment variables
    const pricePerMessage = parseInt(process.env.NEXT_PUBLIC_MESSAGE_PRICE || "1000", 10);
    const amount = messageCount * pricePerMessage;
    
    // Buscar detalhes do token para ajustar a escala dos decimais
    const tokenDetails = await getTokenDetails(tokenId);
    const multiplier = Math.pow(10, tokenDetails.decimals);
    const adjustedAmount = amount * multiplier;
    
    // Log transaction details
    console.log(`Creating message payment transaction: ${messageCount} messages at ${pricePerMessage} tokens each = ${amount} tokens (${adjustedAmount} adjusted for decimals)`);

    // Create a client for transaction preparation
    const client = getClient();
    
    // Create a transfer transaction
    const transaction = new TransferTransaction()
      .addTokenTransfer(
        TokenId.fromString(tokenId),
        AccountId.fromString(senderAccountId),
        -adjustedAmount
      )
      .addTokenTransfer(
        TokenId.fromString(tokenId),
        AccountId.fromString(receiverAccountId),
        adjustedAmount
      )
      .setTransactionId(TransactionId.generate(AccountId.fromString(senderAccountId)))
      .setNodeAccountIds([new AccountId(3)]) // Use node 0.0.3 for testnet
      .freezeWith(client);
    
    return transaction;
  } catch (error: any) {
    console.error('Error creating message payment transaction:', error);
    throw new Error('Failed to create message payment transaction: ' + error.message);
  }
}