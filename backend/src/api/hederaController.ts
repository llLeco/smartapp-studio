import { Request, Response } from 'express';
import * as hederaService from '../services/hederaService';

/**
 * Get operator ID from Hedera service
 * 
 * @route GET /api/hedera/getOperatorId
 */
export const getOperatorId = async (req: Request, res: Response) => {
  try {
    const operatorId = hederaService.getOperatorId();
    
    if (!operatorId) {
      return res.status(500).json({ 
        success: false, 
        error: 'Operator ID not configured' 
      });
    }
    
    return res.json({ 
      success: true, 
      data: operatorId 
    });
  } catch (error: any) {
    console.error('Error getting operator ID:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * Get user's license from Hedera service
 * 
 * @route GET /api/hedera/getUserLicense
 */
export const getUserLicense = async (req: Request, res: Response) => {
  try {
    const { accountId } = req.query;
    
    if (!accountId || typeof accountId !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Account ID is required' 
      });
    }
    
    const licenseInfo = await hederaService.getUserLicense(accountId);
    
    if (!licenseInfo) {
      return res.json({ 
        success: true, 
        data: {
          valid: false,
          reason: 'No license found'
        }
      });
    }
    
    // Get topic messages to summarize usage
    try {
      const messages = await hederaService.getTopicMessages(licenseInfo.topicId);
      const usageInfo = hederaService.summarizeUsage(messages);
      
      return res.json({
        success: true,
        data: {
          valid: true,
          tokenId: licenseInfo.tokenId,
          serialNumber: licenseInfo.serialNumber,
          topicId: licenseInfo.topicId,
          metadata: licenseInfo.metadata,
          ownerId: licenseInfo.ownerId,
          usageInfo
        }
      });
    } catch (messageError) {
      console.error('Error getting topic messages:', messageError);
      
      return res.json({
        success: true,
        data: {
          valid: true,
          tokenId: licenseInfo.tokenId,
          serialNumber: licenseInfo.serialNumber,
          topicId: licenseInfo.topicId,
          metadata: licenseInfo.metadata,
          ownerId: licenseInfo.ownerId,
          usageInfo: null
        }
      });
    }
  } catch (error: any) {
    console.error('Error getting user license:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * Create a new topic for a project
 * 
 * @route POST /api/hedera/createProjectTopic
 */
export const createProjectTopic = async (req: Request, res: Response) => {
  try {
    const { projectName, ownerAccountId } = req.body;
    
    if (!projectName) {
      return res.status(400).json({
        success: false,
        error: 'Project name is required'
      });
    }
    
    const topicId = await hederaService.createProjectTopic(projectName, ownerAccountId);
    
    return res.json({
      success: true,
      data: topicId
    });
  } catch (error: any) {
    console.error('Error creating project topic:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Record a project message in a license topic
 * 
 * @route POST /api/hedera/recordProjectMessage
 */
export const recordProjectMessage = async (req: Request, res: Response) => {
  try {
    const { licenseTopic, projectTopicId, accountId, projectName, timestamp } = req.body;
    
    if (!licenseTopic || !projectTopicId || !accountId || !projectName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const transactionId = await hederaService.recordProjectToLicense(
      licenseTopic,
      projectTopicId,
      accountId,
      projectName,
      timestamp
    );
    
    return res.json({
      success: true,
      data: transactionId
    });
  } catch (error: any) {
    console.error('Error recording project message:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get messages from a topic
 * 
 * @route GET /api/hedera/topicMessages
 */
export const getTopicMessages = async (req: Request, res: Response) => {
  try {
    const { topicId } = req.query;
    
    if (!topicId || typeof topicId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Topic ID is required'
      });
    }
    
    const messages = await hederaService.getTopicMessages(topicId);
    
    return res.json({
      success: true,
      data: messages
    });
  } catch (error: any) {
    console.error('Error getting topic messages:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Transfer a license NFT
 * 
 * @route POST /api/hedera/transferLicense
 */
export const transferLicense = async (req: Request, res: Response) => {
  try {
    const { tokenId, serialNumber, senderId, recipientId } = req.body;
    
    if (!tokenId || !serialNumber || !senderId || !recipientId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }
    
    const transferResult = await hederaService.transferLicense(
      tokenId,
      serialNumber,
      senderId,
      recipientId
    );
    
    return res.json({
      success: true,
      data: transferResult
    });
  } catch (error: any) {
    console.error('Error transferring license:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Process payment for creating a new project
 * 
 * @route POST /api/hedera/processProjectPayment
 */
export const processProjectPayment = async (req: Request, res: Response) => {
  try {
    const { accountId, tokenId, amount } = req.body;
    
    if (!accountId || !tokenId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: accountId, tokenId, and amount are required'
      });
    }
    
    // Process the payment with Hedera
    const result = await hederaService.processPayment(
      tokenId,
      amount,
      accountId
    );
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Payment processing failed'
      });
    }
    
    return res.json({
      success: true,
      data: {
        status: result.status,
        transactionId: result.transactionId
      }
    });
  } catch (error: any) {
    console.error('Error processing project payment:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}; 