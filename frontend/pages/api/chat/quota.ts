import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'PATCH') {
    try {
      const { topicId, transactionId, messageCount } = req.body;
      
      if (!topicId || !transactionId || !messageCount) {
        return res.status(400).json({ 
          error: 'Topic ID, transaction ID, and message count are required' 
        });
      }
      
      // Backend server URL
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
      
      console.log(`Sending quota update to backend: ${backendUrl}/api/chat/quota`);
      console.log('Request body:', { topicId, transactionId, messageCount });
      
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
        console.error('Backend error response:', errorData);
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