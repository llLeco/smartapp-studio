import type { NextApiRequest, NextApiResponse } from 'next';

// Configurar URL base do backend
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

type ResponseData = {
  success: boolean;
  newTotal?: number;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Apenas aceitamos método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { topicId, messageCount, paymentTransactionId } = req.body;

    // Verificações básicas
    if (!topicId || !messageCount) {
      return res.status(400).json({
        success: false,
        error: 'Topic ID and message count are required'
      });
    }

    // Verificar pagamento
    if (!paymentTransactionId) {
      return res.status(400).json({
        success: false,
        error: 'Payment transaction ID is required'
      });
    }

    // Encaminhar requisição para o backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/hedera/add-messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topicId,
        messageCount,
        paymentTransactionId
      }),
    });

    // Obter a resposta do backend
    const data = await backendResponse.json();

    // Retornar a resposta para o cliente
    res.status(backendResponse.status).json(data);
  } catch (error: any) {
    console.error('Error in add-messages API route:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
} 