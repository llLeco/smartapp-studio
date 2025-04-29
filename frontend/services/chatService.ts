export interface ChatMessage {
  text: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  topicId?: string;
}

export interface ChatResponse {
  success: boolean;
  message?: string;
  response?: string;
  error?: string;
}

/**
 * Send a chat message to the AI assistant
 * @param message The message to send
 * @param topicId Optional topic ID for conversation context
 * @returns The assistant's response
 */
export async function sendMessage(
  message: string,
  topicId?: string
): Promise<ChatResponse> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        topicId
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send message');
    }
    
    const result = await response.json();
    
    if (result.success && result.response) {
      return {
        success: true,
        message: message,
        response: result.response
      };
    } else {
      throw new Error(result.error || 'No response received');
    }
  } catch (error: any) {
    console.error('Error sending message:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Format chat history for display
 * @param messages Array of messages to format
 * @returns Formatted chat history
 */
export function formatChatHistory(messages: ChatMessage[]): string {
  return messages
    .map(msg => {
      const role = msg.sender === 'user' ? 'User' : 'Assistant';
      return `${role}: ${msg.text}`;
    })
    .join('\n\n');
}

export default {
  sendMessage,
  formatChatHistory
}; 