import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Asks the OpenAI assistant to generate SmartApp structure based on the prompt
 * @param prompt User's input describing the SmartApp
 * @returns Generated response from the assistant
 */
export async function askAssistant(prompt: string): Promise<any> {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an AI assistant that helps developers create SmartApps using HbarSuite and SmartNodes technology without smart contracts. You can generate app structure, NFT schemas, and base code."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "gpt-3.5-turbo",
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw new Error('Failed to get response from AI assistant');
  }
} 