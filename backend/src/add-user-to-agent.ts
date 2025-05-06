/**
 * Utility script for adding a user account to the agent's connections
 * 
 * Usage: 
 * ts-node add-user-to-agent.ts <userAccountId> <userId>
 * 
 * Example:
 * ts-node add-user-to-agent.ts 0.0.1234567 user123
 */
import dotenv from 'dotenv';
import { connectWithUser } from './services/chatService.js';

// Load environment variables
dotenv.config();

// Get command line arguments
const userAccountId = process.argv[2];
const userId = process.argv[3];

// Validate arguments
if (!userAccountId || !userId) {
  console.error('❌ Error: Both userAccountId and userId are required');
  console.log('Usage: ts-node add-user-to-agent.ts <userAccountId> <userId>');
  process.exit(1);
}

// Main function to add user
async function addUserToAgent() {
  try {
    console.log(`Adding user ${userId} (account: ${userAccountId}) to agent connections...`);
    
    // Connect with the user
    const connectionTopicId = await connectWithUser(userId, userAccountId);
    
    console.log('✅ Successfully added user to agent connections!');
    console.log(`Connection established on topic: ${connectionTopicId}`);
    console.log('\nYou can now send messages to this user with:');
    console.log(`curl -X POST http://localhost:3001/api/chat/send \
      -H "Content-Type: application/json" \
      -d '{"userId":"${userId}","message":"Hello from SmartApp Studio AI Assistant!"}'`);
      
  } catch (error) {
    console.error('❌ Error adding user to agent:', error);
    process.exit(1);
  }
}

// Execute the main function
addUserToAgent().catch(console.error); 