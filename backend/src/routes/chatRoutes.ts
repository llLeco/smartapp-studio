import express, { Request, Response } from 'express';
import { askAssistant, getChatMessages, updateUsageQuota } from '../services/chatService';

const router = express.Router();

// Route to handle chat messages
router.post('/message', async (req: Request, res: Response) => {
  console.log('DEBUG CHAT: chatRoutes.ts - Received message Request', req.body);
  try {
    const { message, topicId, usageQuota } = req.body;
    console.log('DEBUG CHAT: chatRoutes.ts - message', message);
    console.log('DEBUG CHAT: chatRoutes.ts - topicId', topicId);
    console.log('DEBUG CHAT: chatRoutes.ts - usageQuota', usageQuota);
    
    if (!message) {
      console.log('DEBUG CHAT: chatRoutes.ts - Missing message');
      return res.status(400).json({ 
        success: false, 
        error: 'Message is required' 
      });
    }
    
    if (!topicId) {
      console.log('DEBUG CHAT: chatRoutes.ts - Missing topicId');
      return res.status(400).json({ 
        success: false, 
        error: 'Topic ID is required' 
      });
    }
    
    console.log(`DEBUG CHAT: chatRoutes.ts - Processing message for topic ${topicId}`);
    
    // Use the AI assistant to generate a response, passing the topicId
    const response = await askAssistant(message, topicId, usageQuota);
    console.log('DEBUG CHAT: chatRoutes.ts - Got response from askAssistant');
    
    return res.status(200).json({ 
      success: true, 
      response 
    });
  } catch (error: any) {
    console.error('DEBUG CHAT: chatRoutes.ts - Error processing message:', error);
    console.error('Error processing chat message:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to process chat message' 
    });
  }
});

// Route to get chat messages from a topic
router.get('/messages/:topicId', async (req: Request, res: Response) => {
  console.log('Received get messages Request', req.params);
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

// New route to update quota based on transaction ID and message count
router.patch('/quota', async (req: Request, res: Response) => {
  try {
    const { topicId, transactionId, messageCount } = req.body;
    
    if (!topicId || !transactionId || !messageCount) {
      return res.status(400).json({ 
        success: false, 
        error: 'Topic ID, transaction ID, and message count are required' 
      });
    }
    
    console.log(`Updating quota for topic ${topicId} based on transaction ${transactionId} with ${messageCount} messages`);
    
    // Verify the transaction first (could expand this functionality)
    // For now, we'll just update the quota directly
    
    // Get current messages to check current quota
    const messages = await getChatMessages(topicId);
    const currentQuota = messages.length > 0 && messages[messages.length - 1].usageQuota !== undefined 
      ? messages[messages.length - 1].usageQuota 
      : 0;
    
    // Calculate new quota by adding the purchased message count
    const newQuota = currentQuota + messageCount;
    
    // Update the usage quota for the topic
    await updateUsageQuota(topicId, newQuota);
    
    return res.status(200).json({ 
      success: true, 
      transactionId,
      previousQuota: currentQuota,
      newQuota,
      addedQuota: messageCount
    });
  } catch (error: any) {
    console.error('Error updating quota with transaction:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to update quota' 
    });
  }
});

export default router; 