import express, { Request, Response } from 'express';
import { askAssistant, getChatMessages, recordSubscriptionToTopic, SubscriptionDetails } from '../services/aiService';

const router = express.Router();

// Route to handle chat messages
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, topicId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log(`Processing chat message for topic ${topicId}: ${message}`);
    
    // Use the AI assistant to generate a response, passing the topicId
    const response = await askAssistant(message, topicId);
    
    return res.status(200).json({ 
      success: true, 
      response 
    });
  } catch (error) {
    console.error('Error processing chat message:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to process chat message' 
    });
  }
});

// Route to get chat messages from a topic
router.get('/messages/:topicId', async (req: Request, res: Response) => {
  try {
    const { topicId } = req.params;
    
    if (!topicId) {
      return res.status(400).json({ error: 'Topic ID is required' });
    }
    
    console.log(`Retrieving chat messages for topic ${topicId}`);
    
    // Get chat messages from the topic
    const messages = await getChatMessages(topicId);
    
    return res.status(200).json({ 
      success: true, 
      messages 
    });
  } catch (error) {
    console.error('Error retrieving chat messages:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve chat messages' 
    });
  }
});

// Route to process subscription payments
router.post('/subscription', async (req: Request, res: Response) => {
  try {
    const { 
      licenseTopicId, 
      paymentTransactionId, 
      subscription 
    } = req.body;
    
    // Validate required fields
    if (!licenseTopicId) {
      return res.status(400).json({ 
        success: false, 
        error: 'License topic ID is required' 
      });
    }
    
    if (!paymentTransactionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Payment transaction ID is required' 
      });
    }
    
    if (!subscription || typeof subscription !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: 'Subscription details are required' 
      });
    }
    
    // Validate subscription object fields
    const requiredFields: (keyof SubscriptionDetails)[] = [
      'periodMonths', 
      'projectLimit', 
      'messageLimit', 
      'priceUSD', 
      'priceHSuite'
    ];
    
    for (const field of requiredFields) {
      if (subscription[field] === undefined) {
        return res.status(400).json({
          success: false,
          error: `Subscription ${field} is required`
        });
      }
    }
    
    console.log(`Processing subscription payment for license ${licenseTopicId}`);
    console.log(`Subscription details:`, subscription);
    
    // Record the subscription information to the license topic
    const result = await recordSubscriptionToTopic(
      licenseTopicId,
      paymentTransactionId,
      subscription as SubscriptionDetails
    );
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Error processing subscription:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to process subscription'
    });
  }
});

export default router; 