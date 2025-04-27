// frontend/services/licenseService.ts
import { 
  Client,
  AccountId,
  PrivateKey,
  Hbar, 
  PublicKey, 
  TokenAssociateTransaction,
  Transaction,
  TransactionId,
  TokenId,
  TransferTransaction
} from "@hashgraph/sdk";
import getDAppConnector from "../lib/walletConnect";
import type { DAppSigner } from "@hashgraph/hedera-wallet-connect";
import { getTopicMessages } from "./topicService";

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

export interface LicenseCreationState {
  step:
    | "init"
    | "createTopic"
    | "mintToken"
    | "associateToken"
    | "recordLicenseCreationMessage"
    | "transferToken"
    | "complete";
  metadata?: NftMetadata;
  topicId?: string;
  tokenId?: string;
  serialNumber?: number;
  accountId?: string;
  error?: string;
  messageTimestamp?: string;
  transactionStatus?: string;
}

// --- Configuration ---
const NETWORK = "testnet";
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
function api(path: string) {
  return `${BACKEND_URL}${path.startsWith("/") ? path : "/" + path}`;
}

// Mirror Node URL
const MIRROR_NODE_URL = 
  process.env.NEXT_PUBLIC_MIRROR_NODE_URL || 
  "https://testnet.mirrornode.hedera.com";

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

// Each step calls out to your backend — which owns all Hedera SDK logic
export async function initLicenseCreation(
  metadata: NftMetadata
): Promise<LicenseCreationState> {
  const signer = await getSigner();
  const accountId = signer.accountId.toString();

  const fullMetadata: NftMetadata = {
    ...metadata,
    createdAt: new Date().toISOString(),
    creator: accountId,
    type: "LICENSE",
  };

  return { step: "createTopic", metadata: fullMetadata, accountId };
}

export async function createLicenseTopic(
  state: LicenseCreationState
): Promise<LicenseCreationState> {
  try {
    const res = await fetch(api("/api/hedera/createTopic"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata: state.metadata }),
    });
    const { data: topicId } = await res.json();
    
    // Get the token ID from the backend directly
    const tokenRes = await fetch(api("/api/hedera/getLicenseTokenId"));
    const tokenData = await tokenRes.json();
    
    if (!tokenData.success || !tokenData.data) {
      throw new Error("Failed to get license token ID");
    }
    
    return { ...state, step: "mintToken", topicId, tokenId: tokenData.data };
  } catch (e: any) {
    return { ...state, error: e.message };
  }
}

export async function mintLicenseToken(
  state: LicenseCreationState
): Promise<LicenseCreationState> {
  try {
    const res = await fetch(api("/api/hedera/mintToken"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenId: state.tokenId, topicId: state.topicId }),
    });
    const { data: serialNumber } = await res.json();
    return { ...state, step: "associateToken", serialNumber };
  } catch (e: any) {
    return { ...state, error: e.message };
  }
}

export async function associateLicenseToken(
  state: LicenseCreationState
): Promise<LicenseCreationState> {
  try {
    const { accountId } = state;

    //get license token id from backend
    const tokenRes = await fetch(api("/api/hedera/getLicenseTokenId"));
    const tokenData = await tokenRes.json();
    const licenseTokenId = tokenData.data;

    if (!accountId || !licenseTokenId) {
      throw new Error("Missing required data for token association");
    }

    const alreadyAssociated = await isTokenAssociated(accountId, licenseTokenId);
    if (alreadyAssociated) {
      console.log("Token already associated, skipping association");
      return { ...state, step: "recordLicenseCreationMessage" };
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
    return { ...state, step: "recordLicenseCreationMessage" };
  } catch (err: any) {
    // handle already‑associated error gracefully
    if (err.message && err.message.includes("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT") || 
        err.message && err.message.includes("ALREADY_ASSOCIATED")) {
      console.log("Token already associated, continuing to next step");
      return { ...state, step: "recordLicenseCreationMessage" };
    }
    console.error("Error in associateLicenseToken:", err);
    return { ...state, error: err.message };
  }
}

export async function recordLicenseMessage(
  state: LicenseCreationState
): Promise<LicenseCreationState> {
  try {
    const res = await fetch(api("/api/hedera/recordLicenseCreationMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topicId: state.topicId,
        tokenId: state.tokenId,
        serialNumber: state.serialNumber,
        metadata: state.metadata,
      }),
    });
    const { data: messageTimestamp } = await res.json();
    return { ...state, step: "transferToken", messageTimestamp };
  } catch (e: any) {
    return { ...state, error: e.message };
  }
}

export async function transferLicenseWithSubscription(
  state: LicenseCreationState,
): Promise<LicenseCreationState> {
  try {
    if (!state.accountId || !state.tokenId || !state.serialNumber) {
      throw new Error("Missing required data for transfer");
    }

    // Get the operator ID from backend for treasury account
    const operatorRes = await fetch(api("/api/hedera/getOperatorId"));
    const operatorData = await operatorRes.json();
    if (!operatorData.success || !operatorData.data) {
      throw new Error("Failed to get operator ID");
    }
    const operatorId = operatorData.data;

    // Call the backend transferLicense endpoint
    const res = await fetch(api("/api/hedera/transferLicense"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokenId: state.tokenId,
        serialNumber: state.serialNumber,
        senderId: operatorId, // Use operatorId as sender
        recipientId: state.accountId // User account as recipient
      }),
    });
    
    const { success, data, error } = await res.json();
    
    if (!success) {
      throw new Error(error || "License transfer failed");
    }

    return { 
      ...state, 
      step: "complete", 
      transactionStatus: data.status
    };
  } catch (e: any) {
    return { ...state, error: e.message };
  }
}

// convenience: all‑in‑one flow for legacy callers
export async function createLicenseNft(
  metadata: NftMetadata
): Promise<NftInfo> {
  const init = await initLicenseCreation(metadata);
  const t1 = await createLicenseTopic(init);
  if (t1.error) throw new Error(t1.error);
  const t3 = await mintLicenseToken(t1);
  if (t3.error) throw new Error(t3.error);
  const t4 = await associateLicenseToken(t3);
  if (t4.error) throw new Error(t4.error);
  const t5 = await recordLicenseMessage(t4);
  if (t5.error) throw new Error(t5.error);
  const t6 = await transferLicenseWithSubscription(t5);
  if (t6.error) throw new Error(t6.error);
  
  return {
    tokenId: t3.tokenId!,
    serialNumber: t3.serialNumber!,
    topicId: t1.topicId!,
    metadata: metadata as NftMetadata,
  };
}

// check validity now via a single backend call
export async function getUserLicense(accountId: string) {
  try {
    const res = await fetch(api(`/api/license/user/${accountId}`));
    const { success, license, error } = await res.json();
    
    if (!success || !license) {
      console.log('No valid license found:', error || 'User has no license');
      return null;
    }
    
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
    const createResponse = await fetch(api('/api/hedera/createProjectTopic'), {
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
    const recordResponse = await fetch(api('/api/hedera/recordProjectMessage'), {
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

/**
 * Fetch token details from mirror node to get decimals
 */
export async function getTokenDetails(tokenId: string): Promise<{ decimals: number }> {
  try {
    const url = `${MIRROR_NODE_URL}/api/v1/tokens/${tokenId}`;
    console.log(`Fetching token details from: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Mirror node error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Token details:', data);
    
    // Return the decimals value
    return {
      decimals: data.decimals || 0
    };
  } catch (error) {
    console.error('Error fetching token details:', error);
    throw error;
  }
}