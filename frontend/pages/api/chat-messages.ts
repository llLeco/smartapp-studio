import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { topicId } = req.query;
    
    if (!topicId) {
      return res.status(400).json({ error: 'Topic ID is required' });
    }
    
    // URL do servidor backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    
    // Encaminhar a requisição para o backend com o caminho correto
    // Note: smartappRoutes is mounted at '/api' in server.ts, so we need to use /api/messages/:topicId
    const response = await fetch(`${backendUrl}/api/messages/${topicId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.error(`Backend error: ${response.status} - ${await response.text()}`);
      throw new Error(`Backend returned ${response.status}`);
    }
    
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch chat messages'
    });
  }
} 