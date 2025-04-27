import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

  try {
    // Handle GET requests
    if (req.method === 'GET') {
      const { accountId } = req.query;
      
      if (!accountId) {
        return res.status(400).json({ error: 'Account ID is required' });
      }
      
      // Forward request to backend
      const response = await fetch(`${backendUrl}/api/license/user/${accountId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }
      
      const data = await response.json();
      return res.status(200).json(data);
    }
    // Handle POST requests
    else if (req.method === 'POST') {
      const { action } = req.query;
      
      if (!action) {
        return res.status(400).json({ error: 'Action is required' });
      }
      
      // Determine endpoint based on action
      let endpoint;
      
      switch (action) {
        case 'mint':
          endpoint = `${backendUrl}/api/license/mint`;
          break;
        case 'record':
          endpoint = `${backendUrl}/api/license/record`;
          break;
        case 'transfer':
          endpoint = `${backendUrl}/api/license/transfer`;
          break;
        default:
          return res.status(400).json({ error: 'Invalid action' });
      }
      
      // Forward request to backend
      const response = await fetch(endpoint, {
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
    else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in license API:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to process license request' 
    });
  }
} 