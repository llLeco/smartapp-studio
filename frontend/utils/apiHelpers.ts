/**
 * Helper functions for API calls
 */

/**
 * Send a message to the AI assistant
 * @param message The message to send
 * @param topicId The topic ID for the conversation
 * @returns The assistant's response as a string
 */
// export const askAssistant = async (message: string, topicId: string, usageQuota: number): Promise<string> => {
//   console.log(`Sending message to topicId: ${topicId}`);
  
//   try {
//     const response = await fetch('/api/chat', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         message,
//         topicId,
//         usageQuota
//       }),
//     });

//     if (!response.ok) {
//       throw new Error(`Failed to process request: ${response.status}`);
//     }

//     const data = await response.json();
//     return data.response;
//   } catch (error) {
//     console.error('Error sending message:', error);
//     throw error;
//   }
// }; 