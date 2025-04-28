import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

  try {
    // Handle GET requests
    if (req.method === 'GET') {
      const { type, accountId, network } = req.query;
      
      let endpoint;
      
      // Determine endpoint based on type
      switch (type) {
        case 'nfts':
          if (!accountId) {
            return res.status(400).json({ error: 'Account ID is required' });
          }
          endpoint = `${backendUrl}/api/hedera/nfts/${accountId}`;
          break;
        case 'publickey':
          if (!accountId) {
            return res.status(400).json({ error: 'Account ID is required' });
          }
          endpoint = `${backendUrl}/api/hedera/publickey/${accountId}`;
          if (network) {
            endpoint += `?network=${network}`;
          }
          break;
        case 'network':
          endpoint = `${backendUrl}/api/hedera/network`;
          break;
        case 'hsuitetokenid':
          endpoint = `${backendUrl}/api/hedera/hsuitetokenid`;
          break;
        case 'licensetokenid':
          endpoint = `${backendUrl}/api/hedera/licensetokenid`;
          break;
        default:
          return res.status(400).json({ error: 'Invalid request type' });
      }
      
      // Forward request to backend
      const response = await fetch(endpoint, {
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
      const { type } = req.query;
      
      if (type === 'execute') {
        // Forward request to execute a signed transaction
        const response = await fetch(`${backendUrl}/api/hedera/execute`, {
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
    console.error('Error in Hedera API:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to process Hedera request' 
    });
  }
} 