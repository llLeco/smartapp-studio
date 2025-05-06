// Fix express import using dynamic import with CommonJS compatibility
const express = await import('express').then(m => m.default || m);
import { Request, Response } from 'express';
import { askAssistant, getChatMessages, updateUsageQuota, connectWithUser, sendMessageToUser, sendStructuredMessageToUser } from '../services/chatService.js';

const router = express.Router();

// Route to handle chat messages
router.post('/message', async (req: Request, res: Response) => {
  try {
    const { message, topicId, usageQuota } = req.body;
    
    console.log(`🔵 Received chat message request:`, { message, topicId, usageQuota });
    
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
    
    // Validate usageQuota
    if (usageQuota === undefined || usageQuota === null) {
      return res.status(400).json({
        success: false,
        error: 'Usage quota is required'
      });
    }
    
    console.log(`🔵 Calling askAssistant with message: "${message}", topicId: ${topicId}, usageQuota: ${usageQuota}`);
    
    // Always use all three parameters - message, topicId, and usageQuota
    const response = await askAssistant(message, topicId, usageQuota);
    
    console.log(`✅ Generated response: "${response}"`);
    
    return res.status(200).json({ 
      success: true, 
      response,
      remainingQuota: usageQuota > 0 ? usageQuota - 1 : 0
    });
  } catch (error: any) {
    console.error('❌ Error processing chat message:', error);
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

// Route to establish connection with a user via HCS-10
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { userId, userAccountId, connectionRequestId } = req.body;
    
    if (!userId || !userAccountId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID and Hedera account ID are required' 
      });
    }
    
    // Establish connection with the user
    const connectionTopicId = await connectWithUser(userId, userAccountId, connectionRequestId);
    
    return res.status(200).json({ 
      success: true, 
      connectionTopicId
    });
  } catch (error: any) {
    console.error('Error connecting with user:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to connect with user' 
    });
  }
});

// Route to send a message to a connected user
router.post('/send', async (req: Request, res: Response) => {
  try {
    const { userId, message } = req.body;
    
    if (!userId || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID and message are required' 
      });
    }
    
    // Send message to the user
    await sendMessageToUser(userId, message);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Message sent successfully'
    });
  } catch (error: any) {
    console.error('Error sending message to user:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send message to user' 
    });
  }
});

// Route to send structured data to a connected user
router.post('/send-structured', async (req: Request, res: Response) => {
  try {
    const { userId, data } = req.body;
    
    if (!userId || !data) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID and data are required' 
      });
    }
    
    // Send structured data to the user
    await sendStructuredMessageToUser(userId, data);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Structured data sent successfully'
    });
  } catch (error: any) {
    console.error('Error sending structured data to user:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send structured data to user' 
    });
  }
});

export default router; 