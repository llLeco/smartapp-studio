import express, { Request, Response } from 'express';
import { askAssistant } from '../services/aiService';

const router = express.Router();

// Route to generate SmartApp structure
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    const assistantResponse = await askAssistant(prompt);
    
    return res.status(200).json({ 
      success: true, 
      data: assistantResponse 
    });
  } catch (error) {
    console.error('Error generating SmartApp structure:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to generate SmartApp structure' 
    });
  }
});

// Route to handle chat messages
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, topicId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log(`Processing chat message for topic ${topicId}: ${message}`);
    
    // Use the AI assistant to generate a response
    const response = await askAssistant(message);
    
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

export default router; 