import { NextApiRequest, NextApiResponse } from 'next';

// Configure backend URL base
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    console.log('Proxying subscription request to backend...');
    const response = await fetch(`${BACKEND_URL}/api/subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    console.log('Backend response:', data);

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error proxying subscription request:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to process subscription request' 
    });
  }
} 