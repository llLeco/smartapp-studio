import express, { Request, Response } from 'express';
import { getTopicMessages, createTopic } from '../services/topicService.js';
import { NftMetadata } from '../services/licenseService.js';

const router = express.Router();

// Route to get messages from a topic
router.get('/messages/:topicId', async (req: Request, res: Response) => {
  try {
    const { topicId } = req.params;
    
    if (!topicId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Topic ID is required' 
      });
    }
    
    console.log(`Retrieving messages for topic ${topicId}`);
    
    // Get messages from the topic
    const messages = await getTopicMessages(topicId);
    
    return res.status(200).json({ 
      success: true, 
      messages 
    });
  } catch (error: any) {
    console.error('Error retrieving topic messages:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to retrieve topic messages' 
    });
  }
});

// Route to create a new topic
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { metadata } = req.body;
    
    if (!metadata || typeof metadata !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid metadata object is required' 
      });
    }
    
    // Validate metadata object
    if (!metadata.name || !metadata.type) {
      return res.status(400).json({
        success: false,
        error: 'Metadata must include name and type'
      });
    }
    
    console.log(`Creating new topic with metadata: ${JSON.stringify(metadata)}`);
    
    // Create the topic
    const topicId = await createTopic(metadata as NftMetadata);
    
    return res.status(200).json({ 
      success: true, 
      topicId 
    });
  } catch (error: any) {
    console.error('Error creating topic:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create topic' 
    });
  }
});

export default router; 