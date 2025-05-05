import express, { Request, Response } from 'express';
import { 
  getAccountNFTs, 
  getAccountPublicKey, 
  executeSignedTransaction, 
  getClient, 
  getOperatorId, 
  getLicenseCollectionId, 
  getMirrorNodeUrl, 
  getHsuiteTokenId,
} from '../services/hederaService.js';

const router = express.Router();

// Route to get NFTs for an account
router.get('/nfts/:accountId', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    
    if (!accountId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Account ID is required' 
      });
    }
    
    console.log(`Getting NFTs for account ${accountId}`);
    
    // Get account NFTs
    const nfts = await getAccountNFTs(accountId);
    
    return res.status(200).json({ 
      success: true, 
      nfts 
    });
  } catch (error: any) {
    console.error('Error getting account NFTs:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get account NFTs' 
    });
  }
});

// Route to get account public key
router.get('/publickey/:accountId', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    const network = req.query.network as string || 'testnet';
    
    if (!accountId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Account ID is required' 
      });
    }
    
    console.log(`Getting public key for account ${accountId} on ${network}`);
    
    // Get account public key
    const keyInfo = await getAccountPublicKey(accountId, network);
    
    return res.status(200).json({ 
      success: true, 
      key: keyInfo.key,
      type: keyInfo.type
    });
  } catch (error: any) {
    console.error('Error getting account public key:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get account public key' 
    });
  }
});

// Route to execute a signed transaction
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { signedTransactionBytes } = req.body;
    
    if (!signedTransactionBytes) {
      return res.status(400).json({ 
        success: false, 
        error: 'Signed transaction bytes are required' 
      });
    }
    
    console.log('Executing signed transaction');
    
    // Convert the base64 string to Uint8Array
    const transactionBytes = new Uint8Array(Buffer.from(signedTransactionBytes, 'base64'));
    
    // Execute the signed transaction
    const result = await executeSignedTransaction(transactionBytes);
    
    return res.status(200).json({ 
      success: true, 
      status: result.status,
      transactionId: result.transactionId
    });
  } catch (error: any) {
    console.error('Error executing signed transaction:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to execute signed transaction' 
    });
  }
});

// Route to get network information
router.get('/network', async (req: Request, res: Response) => {
  try {
    // Get mirror node URL
    const mirrorNodeUrl = getMirrorNodeUrl();
    
    // Get operator ID
    const operatorId = getOperatorId();
    
    // Get license collection ID
    const licenseCollectionId = getLicenseCollectionId();

    const hsuiteTokenId = getHsuiteTokenId();

    return res.status(200).json({ 
      success: true, 
      mirrorNodeUrl,
      operatorId,
      licenseCollectionId,
      hsuiteTokenId,
      network: process.env.HEDERA_NETWORK || 'testnet'
    });
  } catch (error: any) {
    console.error('Error getting network information:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get network information' 
    });
  }
});

// Route to get HSUITE token ID
router.get('/hsuitetokenid', async (req: Request, res: Response) => {
  try {
    const tokenId = getHsuiteTokenId();

    return res.status(200).json({ 
      success: true, 
      tokenId
    });
  } catch (error: any) {
    console.error('Error getting HSUITE token ID:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get HSUITE token ID' 
    });
  }
});

router.get('/licensetokenid', async (req: Request, res: Response) => {
  try {
    const tokenId = getLicenseCollectionId();
    return res.status(200).json({ success: true, tokenId });
  } catch (error: any) {
    console.error('Error getting license token ID:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get license token ID' 
    });
  }
});



export default router; 