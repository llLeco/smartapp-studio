import express, { Request, Response } from 'express';
import { getUserLicense, mintLicenseToken, recordLicenseCreationMessage, transferHsuiteToken, transferLicense } from '../services/licenseService.js';
import { NftMetadata } from '../services/licenseService.js';

const router = express.Router();

// Route to get a user's license
router.get('/user/:accountId', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    
    if (!accountId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Account ID is required' 
      });
    }
    
    console.log(`Getting license for account ${accountId}`);
    
    // Get user license
    const license = await getUserLicense(accountId);
    
    return res.status(200).json({ 
      success: true, 
      license 
    });
  } catch (error: any) {
    console.error('Error getting user license:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get user license' 
    });
  }
});

// Route to mint a license token
router.post('/mint', async (req: Request, res: Response) => {
  try {
    const { tokenId, topicId } = req.body;
    
    if (!tokenId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token ID is required' 
      });
    }
    
    if (!topicId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Topic ID is required' 
      });
    }
    
    console.log(`Minting license token ${tokenId} with topic ${topicId}`);
    
    // Mint the license token
    const serialNumber = await mintLicenseToken(tokenId, topicId);
    
    return res.status(200).json({ 
      success: true, 
      serialNumber 
    });
  } catch (error: any) {
    console.error('Error minting license token:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to mint license token' 
    });
  }
});

// Route to record license creation message
router.post('/record', async (req: Request, res: Response) => {
  try {
    const { topicId, tokenId, serialNumber, metadata } = req.body;
    
    if (!topicId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Topic ID is required' 
      });
    }
    
    if (!tokenId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token ID is required' 
      });
    }
    
    if (!serialNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Serial number is required' 
      });
    }
    
    if (!metadata || typeof metadata !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid metadata object is required' 
      });
    }
    
    console.log(`Recording license creation for token ${tokenId}, serial ${serialNumber} to topic ${topicId}`);
    
    // Record the license creation message
    const messageTimestamp = await recordLicenseCreationMessage(
      topicId,
      tokenId,
      serialNumber,
      metadata as NftMetadata
    );
    
    return res.status(200).json({ 
      success: true, 
      messageTimestamp 
    });
  } catch (error: any) {
    console.error('Error recording license creation:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to record license creation' 
    });
  }
});

// Route to transfer a license
router.post('/transferLicense', async (req: Request, res: Response) => {
  try {
    const { tokenId, serialNumber, recipientId } = req.body;
    
    if (!tokenId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token ID is required' 
      });
    }
    
    if (!serialNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Serial number is required' 
      });
    }
    
    if (!recipientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Recipient account ID is required' 
      });
    }
    
    console.log(`Transferring license ${tokenId}:${serialNumber} to ${recipientId}`);
    
    // Transfer the license
    const result = await transferLicense(tokenId, serialNumber, recipientId);
    
    return res.status(200).json({ 
      success: true, 
      result 
    });
  } catch (error: any) {
    console.error('Error transferring license:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to transfer license' 
    });
  }
});

// Route to transfer a HSUITE token
router.post('/transferHsuite', async (req: Request, res: Response) => {
  try {
    const { tokenId, accountId } = req.body;

    if (!tokenId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token ID is required' 
      });
    }

    if (!accountId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Account ID is required' 
      });
    }

    console.log(`Transferring HSUITE token ${tokenId} to ${accountId}`);

    // Transfer the HSUITE token
    const result = await transferHsuiteToken(tokenId, accountId);
    
    return res.status(200).json({ 
      success: true, 
      result 
    });
  } catch (error: any) {
    console.error('Error transferring HSUITE token:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to transfer HSUITE token' 
    });
  }
});

    

export default router; 