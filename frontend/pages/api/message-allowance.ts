import type { NextApiRequest, NextApiResponse } from 'next';

// Configurar URL base do backend
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

type MessageAllowanceResponse = {
  success: boolean;
  remainingMessages?: number;
  totalAllowance?: number;
  messagesUsed?: number;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MessageAllowanceResponse>
) {
  const { topicId } = req.query;
  
  if (!topicId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Topic ID is required' 
    });
  }
  
  try {
    // Fazer proxy da requisição para o backend
    const response = await fetch(`${BACKEND_URL}/api/hedera/message-allowance?topicId=${topicId}`);
    
    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }
    
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Error fetching message allowance:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch message allowance'
    });
  }
} 