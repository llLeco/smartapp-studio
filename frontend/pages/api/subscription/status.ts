import { NextApiRequest, NextApiResponse } from 'next';

// Configure backend URL base
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { accountId } = req.query;

  if (!accountId) {
    return res.status(400).json({ success: false, error: 'Account ID is required' });
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/subscription/status?accountId=${accountId}`);
    const data = await response.json();

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch subscription status' 
    });
  }
} 