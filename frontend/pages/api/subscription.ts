import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

  try {
    // Handle GET requests
    if (req.method === 'GET') {
      const { topicId } = req.query;
      
      if (!topicId) {
        return res.status(400).json({ error: 'Topic ID is required' });
      }
      
      // Forward request to backend to get subscription details
      const response = await fetch(`${backendUrl}/api/subscription/details/${topicId}`, {
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
    } 
    // Handle POST requests
    else if (req.method === 'POST') {
      const { action } = req.query;
      
      // Handle subscription recording
      if (action === 'record') {
        const response = await fetch(`${backendUrl}/api/subscription/record`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(req.body),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          return res.status(response.status).json(errorData);
        }
        
        const data = await response.json();
        return res.status(200).json(data);
      } 
      // Legacy compatibility route
      else if (action === 'smartapp') {
        const response = await fetch(`${backendUrl}/api/subscription/smartapp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(req.body),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          return res.status(response.status).json(errorData);
        }
        
        const data = await response.json();
        return res.status(200).json(data);
      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }
    } 
    else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in subscription API:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to process subscription request' 
    });
  }
} 