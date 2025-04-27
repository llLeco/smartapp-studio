import express, { Request, Response } from 'express';
import { getSubscriptionDetails, recordSubscriptionToTopic, SubscriptionDetails } from '../services/subscriptionService';

const router = express.Router();

// Route to get subscription details for a license topic
router.get('/details/:topicId', async (req: Request, res: Response) => {
  try {
    const { topicId } = req.params;
    
    if (!topicId) {
      return res.status(400).json({ 
        success: false, 
        error: 'License topic ID is required' 
      });
    }
    
    console.log(`Getting subscription details for topic ${topicId}`);
    
    // Get subscription details
    const result = await getSubscriptionDetails(topicId);
    
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Error getting subscription details:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get subscription details' 
    });
  }
});

// Route to record a subscription to a license topic
router.post('/record', async (req: Request, res: Response) => {
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
    
    console.log(`Recording subscription to license ${licenseTopicId}`);
    console.log(`Subscription details:`, subscription);
    
    // Record the subscription information to the license topic
    const result = await recordSubscriptionToTopic(
      licenseTopicId,
      paymentTransactionId,
      subscription as SubscriptionDetails
    );
    
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Error recording subscription:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to record subscription' 
    });
  }
});

// Legacy route for compatibility (from authRoutes.ts)
router.get('/auth/:topicId', async (req: Request, res: Response) => {
  try {
    const { topicId } = req.params;
    
    if (!topicId) {
      return res.status(400).json({ 
        success: false, 
        error: 'License topic ID is required' 
      });
    }
    
    console.log(`Getting subscription details for topic ${topicId} (auth endpoint)`);
    
    // Get subscription details
    const result = await getSubscriptionDetails(topicId);
    
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Error getting subscription details:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get subscription details' 
    });
  }
});

// Legacy route for compatibility (from smartapp.ts)
router.post('/smartapp', async (req: Request, res: Response) => {
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
    
    console.log(`Processing subscription payment for license ${licenseTopicId} (smartapp endpoint)`);
    console.log(`Subscription details:`, subscription);
    
    // Record the subscription information to the license topic
    const result = await recordSubscriptionToTopic(
      licenseTopicId,
      paymentTransactionId,
      subscription as SubscriptionDetails
    );
    
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