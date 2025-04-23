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
    | "recordMessage"
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

// Mirror Node URL based on network
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

/**
 * Associates the given NFT token with the user's Hedera account via WalletConnect.
 */
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
      return { ...state, step: "recordMessage" };
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
    return { ...state, step: "recordMessage" };
  } catch (err: any) {
    // handle already‑associated error gracefully
    if (err.message && err.message.includes("TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT") || 
        err.message && err.message.includes("ALREADY_ASSOCIATED")) {
      console.log("Token already associated, continuing to next step");
      return { ...state, step: "recordMessage" };
    }
    console.error("Error in associateLicenseToken:", err);
    return { ...state, error: err.message };
  }
}

export async function recordLicenseMessage(
  state: LicenseCreationState
): Promise<LicenseCreationState> {
  try {
    const res = await fetch(api("/api/hedera/recordMessage"), {
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
export async function checkLicenseValidity(accountId: string) {
  try {
    const res = await fetch(api(`/api/hedera/getUserLicense?accountId=${accountId}`));
    const { success, data, error } = await res.json();
    
    if (!success || !data) {
      console.log('No valid license found:', error || 'User has no license');
      return { isValid: false, licenseInfo: null, usageInfo: null };
    }
    
    return {
      isValid: data.valid,
      licenseInfo: {
        tokenId: data.tokenId,
        serialNumber: data.serialNumber,
        topicId: data.topicId,
        metadata: data.metadata,
        ownerId: data.ownerId
      },
      usageInfo: data.usageInfo
    };
  } catch (e) {
    console.error('Error checking license validity:', e);
    return { isValid: false, licenseInfo: null, usageInfo: null };
  }
}

// --- Project Management ---
export async function createNewProject(
  licenseTopic: string, 
  accountId: string,
  projectName: string
): Promise<{ success: boolean; projectTopicId: string; error?: string }> {
  try {
    // Create a new topic for the project via backend
    const createRes = await fetch(api("/api/hedera/createProjectTopic"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        projectName,
        ownerAccountId: accountId
      }),
    });
    
    if (!createRes.ok) {
      const errorData = await createRes.json();
      throw new Error(errorData.error || 'Failed to create project topic');
    }
    
    const { success, data: projectTopicId, error } = await createRes.json();
    
    if (!success || !projectTopicId) {
      throw new Error(error || 'Failed to create project topic');
    }
    
    console.log(`Project topic created: ${projectTopicId}`);
    
    // Link the project to the license by recording a message in the license topic
    const linkRes = await fetch(api("/api/hedera/recordProjectMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseTopic,
        projectTopicId,
        accountId,
        projectName,
        timestamp: new Date().toISOString()
      }),
    });
    
    if (!linkRes.ok) {
      const errorData = await linkRes.json();
      throw new Error(errorData.error || 'Failed to record project in license');
    }
    
    const linkData = await linkRes.json();
    
    if (!linkData.success) {
      throw new Error(linkData.error || 'Failed to record project in license');
    }
    
    return {
      success: true,
      projectTopicId
    };
  } catch (error: any) {
    console.error('Error creating new project:', error);
    return {
      success: false,
      projectTopicId: '',
      error: error.message || 'Failed to create new project'
    };
  }
}

// --- Project Retrieval ---
export interface Project {
  projectTopicId: string;
  projectName: string;
  createdAt: string;
  ownerAccountId: string;
}

export async function getUserProjects(licenseTopic: string): Promise<Project[]> {
  try {
    // Get all messages from the license topic
    const messagesRes = await fetch(api(`/api/hedera/topicMessages?topicId=${licenseTopic}`));
    
    if (!messagesRes.ok) {
      throw new Error('Failed to fetch topic messages');
    }
    
    const { success, data: messages, error } = await messagesRes.json();
    
    if (!success || !messages) {
      throw new Error(error || 'Failed to fetch topic messages');
    }
    
    // Filter messages to find project creation messages
    const projectMessages = messages.filter((msg: any) => 
      msg.content && msg.content.type === 'PROJECT_CREATED'
    );
    
    // Extract project data from messages
    const projects: Project[] = projectMessages.map((msg: any) => ({
      projectTopicId: msg.content.projectTopicId,
      projectName: msg.content.projectName,
      createdAt: msg.content.createdAt,
      ownerAccountId: msg.content.ownerAccountId
    }));
    
    console.log(`Found ${projects.length} projects for license topic ${licenseTopic}`);
    return projects;
  } catch (error: any) {
    console.error('Error fetching user projects:', error);
    return [];
  }
}