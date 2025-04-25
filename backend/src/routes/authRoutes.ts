import express, { Request, Response } from 'express';
import { getSubscriptionDetails } from '../services/authService';

const router = express.Router();

// Route to get subscription details
router.get('/subscription/:topicId', async (req: Request, res: Response) => {
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
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Error getting subscription details:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to get subscription details'
    });
  }
});

export default router; 