import { Client, Transaction } from "@hashgraph/sdk";
import getDAppConnector from "../lib/walletConnect";

// --- Configuration ---
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
function api(path: string) {
  return `${BACKEND_URL}${path.startsWith("/") ? path : "/" + path}`;
}
const MIRROR_NODE_URL = process.env.NEXT_PUBLIC_MIRROR_NODE_URL || "https://testnet.mirrornode.hedera.com";

// --- Types ---
export interface NetworkInfo {
  mirrorNodeUrl: string;
  operatorId: string;
  licenseCollectionId: string;
  network: string;
}

export interface AccountNft {
  tokenId: string;
  serialNumber: number;
  accountId: string;
  metadata?: any;
  type?: string;
}

export interface PublicKeyInfo {
  key: string;
  type: string;
}

export interface TransactionResult {
  status: string;
  transactionId: string;
}

/**
 * Fetch network information from the backend
 * @returns Network information including mirror node URL, operator ID, and network type
 */
export async function getNetworkInfo(): Promise<NetworkInfo> {
  try {
    const response = await fetch(`/api/hedera?type=network`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch network information');
    }

    const data = await response.json();
    return data.mirrorNodeUrl && data.operatorId 
      ? data
      : { 
          mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
          operatorId: '0.0.xxxxx',
          licenseCollectionId: '0.0.xxxxx',
          network: 'testnet'
        };
  } catch (error: any) {
    console.error('Error fetching network info:', error);
    throw error;
  }
}

/**
 * Get NFTs owned by an account
 * @param accountId The Hedera account ID
 * @returns Array of NFTs owned by the account
 */
export async function getAccountNFTs(accountId: string): Promise<AccountNft[]> {
  try {
    const response = await fetch(`/api/hedera?type=nfts&accountId=${accountId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch account NFTs');
    }

    const data = await response.json();
    return data.success && data.nfts ? data.nfts : [];
  } catch (error: any) {
    console.error('Error fetching account NFTs:', error);
    throw error;
  }
}

/**
 * Get the public key for an account
 * @param accountId The Hedera account ID
 * @param network Optional network (testnet or mainnet)
 * @returns Public key information
 */
export async function getAccountPublicKey(
  accountId: string,
  network?: string
): Promise<PublicKeyInfo> {
  try {
    let url = `/api/hedera?type=publickey&accountId=${accountId}`;
    if (network) {
      url += `&network=${network}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch account public key');
    }

    const data = await response.json();
    return data.success && data.key ? { key: data.key, type: data.type } : { key: '', type: '' };
  } catch (error: any) {
    console.error('Error fetching account public key:', error);
    throw error;
  }
}

/**
 * Execute a signed transaction
 * @param signedTransactionBytes Signed transaction bytes as a base64 string
 * @returns Transaction result
 */
export async function executeSignedTransaction(
  signedTransactionBytes: string
): Promise<TransactionResult> {
  try {
    const response = await fetch(`/api/hedera?type=execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ signedTransactionBytes }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to execute transaction');
    }

    const data = await response.json();
    return data.success ? { status: data.status, transactionId: data.transactionId } : { status: 'FAILED', transactionId: '' };
  } catch (error: any) {
    console.error('Error executing signed transaction:', error);
    throw error;
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

export default {
  getNetworkInfo,
  getAccountNFTs,
  getAccountPublicKey,
  executeSignedTransaction,
}; 