// backend/routes/hedera.ts
import express, { Request, Response } from 'express';
import {
  getAccountNFTs,
  getTopicMessages,
  summarizeUsage,
  getAccountPublicKey,
  mintLicenseToUser,
  getUserLicense,
  createTopic,
  createToken,
  mintToken,
  recordMessage,
  transferLicense,
  executeSignedTransaction,
  getLicenseTokenId,
  getOperatorId,
  createProjectTopic,
  recordProjectToLicense
} from '../services/hederaService';

const router = express.Router();

// GET /api/hedera/accountNFTs?accountId=0.0.x
router.get('/accountNFTs', async (req: Request, res: Response) => {
  try {
    const accountId = req.query.accountId as string;
    if (!accountId) {
      return res.status(400).json({ success: false, error: 'accountId is required' });
    }
    const nfts = await getAccountNFTs(accountId);
    res.json({ success: true, data: nfts });
  } catch (err) {
    console.error('accountNFTs error', err);
    res.status(500).json({ success: false, error: 'Failed to fetch NFTs' });
  }
});

// GET /api/hedera/topicMessages?topicId=0.0.y
router.get('/topicMessages', async (req: Request, res: Response) => {
  try {
    const topicId = req.query.topicId as string;
    if (!topicId) {
      return res.status(400).json({ success: false, error: 'topicId is required' });
    }
    const messages = await getTopicMessages(topicId);
    res.json({ success: true, data: messages });
  } catch (err) {
    console.error('topicMessages error', err);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

// POST /api/hedera/summarizeUsage
router.post('/summarizeUsage', async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages)) {
      return res.status(400).json({ success: false, error: 'messages array is required' });
    }
    const summary = summarizeUsage(messages);
    res.json({ success: true, data: summary });
  } catch (err) {
    console.error('summarizeUsage error', err);
    res.status(500).json({ success: false, error: 'Failed to summarize usage' });
  }
});

// GET /api/hedera/accountPublicKey?accountId=0.0.x&network=testnet
router.get('/accountPublicKey', async (req: Request, res: Response) => {
  try {
    const accountId = req.query.accountId as string;
    const network = (req.query.network as string) || 'testnet';
    if (!accountId) {
      return res.status(400).json({ success: false, error: 'accountId is required' });
    }
    const keyInfo = await getAccountPublicKey(accountId, network);
    res.json({ success: true, data: keyInfo });
  } catch (err) {
    console.error('accountPublicKey error', err);
    res.status(500).json({ success: false, error: 'Failed to fetch public key' });
  }
});

// POST /api/hedera/mintLicense
router.post('/mintLicense', async (req: Request, res: Response) => {
  try {
    const { userAccountId } = req.body;
    if (!userAccountId) {
      return res.status(400).json({ success: false, error: 'userAccountId is required' });
    }
    const result = await mintLicenseToUser(userAccountId);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('mintLicense error', err);
    res.status(500).json({ success: false, error: 'Failed to mint license' });
  }
});

// GET /api/hedera/getUserLicense?accountId=0.0.x
router.get('/getUserLicense', async (req: Request, res: Response) => {
  try {
    const accountId = req.query.accountId as string;
    if (!accountId) {
      return res.status(400).json({ success: false, error: 'accountId is required' });
    }
    const license = await getUserLicense(accountId);
    res.json({ success: true, data: license });
  } catch (err) {
    console.error('getUserLicense error', err);
    res.status(500).json({ success: false, error: 'Failed to get user license' });
  }
});

// POST /api/hedera/createTopic
router.post('/createTopic', async (req: Request, res: Response) => {
  try {
    const { metadata } = req.body;
    if (!metadata) {
      return res.status(400).json({ success: false, error: 'metadata is required' });
    }
    
    const topicId = await createTopic(metadata);
    res.json({ success: true, data: topicId });
  } catch (err) {
    console.error('createTopic error', err);
    res.status(500).json({ success: false, error: 'Failed to create topic' });
  }
});

// POST /api/hedera/createToken
router.post('/createToken', async (req: Request, res: Response) => {
  try {
    const { topicId } = req.body;
    if (!topicId) {
      return res.status(400).json({ success: false, error: 'topicId is required' });
    }
    
    const tokenId = await createToken(topicId);
    res.json({ success: true, data: tokenId });
  } catch (err) {
    console.error('createToken error', err);
    res.status(500).json({ success: false, error: 'Failed to create token' });
  }
});

// POST /api/hedera/mintToken
router.post('/mintToken', async (req: Request, res: Response) => {
  try {
    const { tokenId, topicId } = req.body;
    if (!tokenId || !topicId) {
      return res.status(400).json({ success: false, error: 'tokenId and topicId are required' });
    }
    
    const serialNumber = await mintToken(tokenId, topicId);
    res.json({ success: true, data: serialNumber });
  } catch (err) {
    console.error('mintToken error', err);
    res.status(500).json({ success: false, error: 'Failed to mint token' });
  }
});

// POST /api/hedera/recordMessage
router.post('/recordMessage', async (req: Request, res: Response) => {
  try {
    const { topicId, tokenId, serialNumber, metadata } = req.body;
    if (!topicId || !tokenId || !serialNumber || !metadata) {
      return res.status(400).json({ 
        success: false, 
        error: 'topicId, tokenId, serialNumber, and metadata are required' 
      });
    }
    
    const messageTimestamp = await recordMessage(topicId, tokenId, serialNumber, metadata);
    res.json({ success: true, data: messageTimestamp });
  } catch (err) {
    console.error('recordMessage error', err);
    res.status(500).json({ success: false, error: 'Failed to record message' });
  }
});

// POST /api/hedera/executeSignedTransaction
router.post('/executeSignedTransaction', async (req: Request, res: Response) => {
  try {
    const { signedTransactionBytes } = req.body;
    if (!signedTransactionBytes) {
      return res.status(400).json({ success: false, error: 'signedTransactionBytes is required' });
    }
    
    // Convert from base64 back to bytes
    const signedTransaction = Buffer.from(signedTransactionBytes, 'base64');
    
    const status = await executeSignedTransaction(signedTransaction);
    res.json({ success: true, data: { status } });
  } catch (err) {
    console.error('executeSignedTransaction error', err);
    res.status(500).json({ success: false, error: 'Failed to execute signed transaction' });
  }
});

// POST /api/hedera/transferLicense
router.post('/transferLicense', async (req: Request, res: Response) => {
  try {
    const { tokenId, serialNumber, senderId, recipientId } = req.body;
    if (!tokenId || !serialNumber || !senderId || !recipientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'tokenId, serialNumber, senderId, and recipientId are required' 
      });
    }
    
    const result = await transferLicense(tokenId, serialNumber, senderId, recipientId);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('transferLicense error', err);
    res.status(500).json({ success: false, error: 'Failed to transfer license' });
  }
});

// GET /api/hedera/getLicenseTokenId
router.get('/getLicenseTokenId', async (req: Request, res: Response) => {
  try {
    const tokenId = getLicenseTokenId();
    if (!tokenId) {
      return res.status(500).json({ 
        success: false, 
        error: 'LICENSE_TOKEN_ID environment variable is not set' 
      });
    }
    
    res.json({ success: true, data: tokenId });
  } catch (err) {
    console.error('getLicenseTokenId error', err);
    res.status(500).json({ success: false, error: 'Failed to get license token ID' });
  }
});

// GET /api/hedera/getOperatorId
router.get('/getOperatorId', async (req: Request, res: Response) => {
  try {
    const operatorId = getOperatorId();
    if (!operatorId) {
      return res.status(500).json({ 
        success: false, 
        error: 'HEDERA_OPERATOR_ID environment variable is not set' 
      });
    }
    
    res.json({ success: true, data: operatorId });
  } catch (err) {
    console.error('getOperatorId error', err);
    res.status(500).json({ success: false, error: 'Failed to get operator ID' });
  }
});

// POST /api/hedera/createProjectTopic
router.post('/createProjectTopic', async (req: Request, res: Response) => {
  try {
    const { projectName, ownerAccountId, chatCount } = req.body;
    
    if (!projectName) {
      return res.status(400).json({ success: false, error: 'Project name is required' });
    }
    
    const projectTopic = await createProjectTopic(projectName, ownerAccountId, chatCount);
    
    res.json({ success: true, data: projectTopic });
  } catch (err) {
    console.error('createProjectTopic error', err);
    res.status(500).json({ success: false, error: 'Failed to create project topic' });
  }
});

// POST /api/hedera/recordProjectMessage
router.post('/recordProjectMessage', async (req: Request, res: Response) => {
  try {
    const { licenseTopic, projectTopicId, accountId, projectName, timestamp, chatCount } = req.body;
    
    if (!licenseTopic || !projectTopicId || !accountId) {
      return res.status(400).json({ 
        success: false, 
        error: 'License topic, project topic, and account ID are required' 
      });
    }
    
    const messageId = await recordProjectToLicense(
      licenseTopic, 
      projectTopicId, 
      accountId, 
      projectName,
      timestamp,
      chatCount
    );
    
    res.json({ success: true, data: messageId });
  } catch (err) {
    console.error('recordProjectMessage error', err);
    res.status(500).json({ success: false, error: 'Failed to record project message' });
  }
});

// POST /api/hedera/processProjectPayment
router.post('/processProjectPayment', async (req: Request, res: Response) => {
  try {
    const { signedTransactionBytes } = req.body;
    
    if (!signedTransactionBytes) {
      return res.status(400).json({
        success: false,
        error: 'Signed transaction bytes are required'
      });
    }
    
    // Convert from base64 back to bytes
    const signedTransaction = Buffer.from(signedTransactionBytes, 'base64');
    
    // Execute the signed transaction
    const result = await executeSignedTransaction(signedTransaction);
    
    return res.json({
      success: true,
      data: {
        status: result.status,
        transactionId: result.transactionId
      }
    });
  } catch (err: any) {
    console.error('Error processing project payment:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error'
    });
  }
});

export default router;
