// backend/services/hederaService.ts
import "dotenv/config";
import { Client, Transaction } from "@hashgraph/sdk";


const MIRROR_NODE_BASE_URL = {
  mainnet: "https://mainnet-public.mirrornode.hedera.com",
  testnet: "https://testnet.mirrornode.hedera.com",
  previewnet: "https://previewnet.mirrornode.hedera.com"
};

export const getMirrorNodeUrl = () => {
  const network = process.env.HEDERA_NETWORK || 'testnet';
  return MIRROR_NODE_BASE_URL[network as keyof typeof MIRROR_NODE_BASE_URL] || MIRROR_NODE_BASE_URL.testnet;
};

export const getClient = () => {
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

export const getAccountNFTs = async (accountId: string) => {
  const url = `${getMirrorNodeUrl()}/api/v1/accounts/${accountId}/nfts`;
  const response = await fetch(url);
  const data = await response.json();
  return data.nfts || [];
};

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

export const getOperatorId = (): string | null => {
  const operatorId = process.env.HEDERA_OPERATOR_ID;
  if (!operatorId) {
    console.warn('HEDERA_OPERATOR_ID environment variable is not set');
    return null;
  }
  return operatorId;
}

export const getHsuiteTokenId = (): string | null => {
  const tokenId = process.env.HSUITE_TOKEN_ID;
  if (!tokenId) {
    console.warn('HSUITE_TOKEN_ID environment variable is not set');
    return null;
  }
  return tokenId;
}
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

export const getLicenseCollectionId = (): string | null => {
  const tokenId = process.env.LICENSE_TOKEN_ID;
  if (!tokenId) {
    console.warn('LICENSE_TOKEN_ID environment variable is not set');
    return null;
  }
  return tokenId;
}