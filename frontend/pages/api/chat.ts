import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { message, topicId } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }
      
      // Backend server URL
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
      
      // Forward the request to the backend
      const response = await fetch(`${backendUrl}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, topicId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      }
      
      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      console.error('Error in chat API:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to process chat message',
        response: 'An error occurred while processing your request. Please try again.'
      });
    }
  } else if (req.method === 'GET') {
    try {
      const { topicId } = req.query;
      
      if (!topicId) {
        return res.status(400).json({ error: 'Topic ID is required' });
      }
      
      // Backend server URL
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
      
      // Forward the request to the backend
      const response = await fetch(`${backendUrl}/api/chat/messages/${topicId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      }
      
      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch chat messages',
        response: 'An error occurred while fetching messages. Please try again.'
      });
    }
  } else if (req.method === 'PATCH') {
    try {
      const { topicId, transactionId, messageCount } = req.body;
      
      if (!topicId || !transactionId || !messageCount) {
        return res.status(400).json({ 
          error: 'Topic ID, transaction ID, and message count are required' 
        });
      }
      
      // Backend server URL
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
      
      // Forward the request to the backend
      const response = await fetch(`${backendUrl}/api/chat/quota`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          topicId, 
          transactionId, 
          messageCount 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      }
      
      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      console.error('Error updating quota:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to update quota',
        response: 'An error occurred while updating your message quota. Please try again.'
      });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
} 