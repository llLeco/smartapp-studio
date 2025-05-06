/**
 * Script to register an AI agent using the HCS-10 standard on Hedera using @hashgraphonline/standards-sdk.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Current directory configuration (required for ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Check if required environment variables are defined
if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY || !process.env.HEDERA_NETWORK) {
  console.error('Error: HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, and HEDERA_NETWORK environment variables are required');
  process.exit(1);
}

// Main async function to register the agent
async function main() {
  try {
    console.log('Loading @hashgraphonline/standards-sdk module...');
    
    // Import SDK using dynamic import
    const sdkModule = await import('@hashgraphonline/standards-sdk');
    
    console.log('Module loaded successfully.');
    
    // Extract required classes and enums
    const { HCS10Client, AgentBuilder, InboundTopicType, AIAgentCapability } = sdkModule;

    // Initialize HCS-10 client with operator account credentials
    console.log('Initializing HCS-10 client...');
    const hcs10Client = new HCS10Client({
      network: 'testnet',
      operatorId: process.env.HEDERA_ACCOUNT_ID,
      operatorPrivateKey: process.env.HEDERA_PRIVATE_KEY,
      logLevel: 'info'
    });
    console.log('HCS-10 client initialized.');

    // Define the system prompt for the agent
    const systemPrompt = `
      You are a professional AI assistant specialized in helping developers build SmartApps using HbarSuite and SmartNodes — without traditional smart contracts.

      Your role is to **guide, scaffold, and generate validator configurations** in JSON format.

      Use this behavior model:

      - If the user's input is vague, ask focused questions to gather enough context to generate a validator file.
      - Once you have enough data, **always return a complete validator file in JSON** with **inline comments** explaining key parts.
      - Use code blocks with \`\`\`json and explain logic in Markdown format.
      - Offer to scaffold full files, NFT token schemas, or topic interfaces when relevant.
      - Prioritize clarity, simplicity, and actionability.

      Reference official documentation: https://docs.hsuite.finance/

      ---

      **Validator File Examples:**

      **Account Validator:**
      \`\`\`json
      { "smartNodeSecurity": "full", "updateConditions": { "values": [], "controller": "owner" }, "actionsConditions": { "values": [ "transfer", "delete", "update", "allowance-approval", "allowance-delete" ], "controller": "owner" }, "tokenGates": { "fungibles": { "tokens": [ { "tokenId": "0.0.2203022", "amount": 1 } ] }, "nonFungibles": { "tokens": [ { "tokenId": "0.0.2666543", "serialNumbers": [1,2,3], "snapshot": { "cid": "..." } } ] }, "timeRange": { "from": 0, "to": 0 } }, "swapConditions": { "prices": [] } }
      \`\`\`

      **Token Validator:**
      \`\`\`json
      { "smartNodeSecurity": "full", "updateConditions": { "values": ["name", "symbol"], "controller": "owner" }, "actionsConditions": { "values": ["pause", "unpause", "freeze"], "controller": "owner" }, "feesConditions": { "values": ["fixed"], "controller": "owner" }, "keysConditions": { "values": ["admin", "supply"], "controller": "owner" } }
      \`\`\`

      **Topic Validator:**
      \`\`\`json
      { "smartNodeSecurity": "full", "actionConditions": { "values": ["update", "delete", "message"], "controller": "owner" }, "updateConditions": { "values": ["memo"], "controller": "owner" }, "customInterface": { "interfaceName": "Dao", "properties": { "daoId": "string", "votingRules": { "threshold": "number" } } } }
      \`\`\`

      ---

      Respond like a mentor — always practical, always building, always validating.
    `;

    console.log('Starting agent configuration...');
    
    // Configure agent builder with method availability check
    const builder = new AgentBuilder()
    .setName('SmartApp Studio AI Assistant')
    .setAlias('smartapp_studio_ai_assistant')
    .setDescription('SmartApp Studio is a platform for building SmartApps using HbarSuite and SmartNodes')
    .setAgentType(1)
    .setModel('gpt-4')
    .setNetwork('testnet')
    .setInboundTopicType(InboundTopicType.CONTROLLED)
    .setCapabilities([
      AIAgentCapability.TEXT_GENERATION,
      AIAgentCapability.KNOWLEDGE_RETRIEVAL
    ])
    
    console.log('Configuring basic agent properties...');

    // Configure progress callback to show registration progress
    const progressCallback = (progress) => {
      if (progress && typeof progress.stage === 'string' && typeof progress.progressPercent === 'number') {
        console.log(`→ ${progress.stage}: ${progress.progressPercent}%`);
      } else {
        console.log('→ Progress received:', progress);
      }
    };

    console.log('Starting agent registration...');
    // Register the agent
    const result = await hcs10Client.createAndRegisterAgent(builder, { progressCallback });

    // Display registration result information
    console.log('\n✅ Agent registered successfully!\n');
    console.log('=================== AGENT INFORMATION ===================');
    
    // Check and display all available properties in the result
    console.log('All available properties in the result:');
    Object.keys(result).forEach(key => {
      console.log(`- ${key}: ${typeof result[key] === 'object' ? JSON.stringify(result[key]) : result[key]}`);
    });
    
    // Display specific expected properties
    console.log('\nSpecific properties:');
    if (result.accountId || result.agentId) 
      console.log('Account ID:       ', result.accountId || result.agentId);
    
    if (result.inboundTopicId) 
      console.log('Inbound Topic ID: ', result.inboundTopicId);
    
    if (result.outboundTopicId) 
      console.log('Outbound Topic ID:', result.outboundTopicId);
    
    if (result.profileTopicId || result.profileId) 
      console.log('Profile Topic ID: ', result.profileTopicId || result.profileId);
    
    if (result.privateKey) 
      console.log('\n⚠️  PRIVATE KEY (keep it secure!):\n', result.privateKey);
    
    console.log('===========================================================');
    console.log('\nKeep this information in a secure location.');
    console.log('You will need it to configure your agent in the application.');
    
  } catch (error) {
    console.error('❌ Error registering agent:', error);
    // Additional error logging for debugging
    if (error.stack) {
      console.error('Error stack:', error.stack);
    }
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

// Execute main function
main().catch(error => {
  console.error('❌ Fatal error in script:', error);
  process.exit(1);
}); 