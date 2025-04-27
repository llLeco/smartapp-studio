import express, { Request, Response } from 'express';
import { askAssistant, getChatMessages, updateUsageQuota } from '../services/chatService';

const router = express.Router();

// Route to handle chat messages
router.post('/message', async (req: Request, res: Response) => {
  try {
    const { message, topicId, usageQuota } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message is required' 
      });
    }
    
    if (!topicId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Topic ID is required' 
      });
    }
    
    console.log(`Processing chat message for topic ${topicId}: ${message}`);
    
    // Use the AI assistant to generate a response, passing the topicId
    const response = await askAssistant(message, topicId, usageQuota);
    
    return res.status(200).json({ 
      success: true, 
      response 
    });
  } catch (error: any) {
    console.error('Error processing chat message:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to process chat message' 
    });
  }
});

// Route to get chat messages from a topic
router.get('/messages/:topicId', async (req: Request, res: Response) => {
  try {
    const { topicId } = req.params;
    
    if (!topicId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Topic ID is required' 
      });
    }
    
    console.log(`Retrieving chat messages for topic ${topicId}`);
    
    // Get chat messages from the topic
    const messages = await getChatMessages(topicId);
    
    return res.status(200).json({ 
      success: true, 
      messages 
    });
  } catch (error: any) {
    console.error('Error retrieving chat messages:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to retrieve chat messages' 
    });
  }
});

// Route to update the usage quota for a topic
router.post('/updateQuota', async (req: Request, res: Response) => {
  try {
    const { topicId, usageQuota } = req.body;

    if (!topicId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Topic ID is required' 
      }); 
    }

    // Update the usage quota for the topic
    const updatedQuota = await updateUsageQuota(topicId, usageQuota);

    return res.status(200).json({ 
      success: true, 
      updatedQuota 
    });
  } catch (error: any) {
    console.error('Error updating usage quota:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to update usage quota' 
    });
  }
});

export default router; 