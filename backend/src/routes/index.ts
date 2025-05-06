import express from 'express';
import hederaRoutes from './hederaRoutes.js';
import topicRoutes from './topicRoutes.js';
import licenseRoutes from './licenseRoutes.js';
import subscriptionRoutes from './subscriptionRoutes.js';
import projectRoutes from './projectRoutes.js';
import chatRoutes from './chatRoutes.js';

const router = express.Router();

// Mount all route groups
router.use('/hedera', hederaRoutes);
router.use('/topic', topicRoutes);
router.use('/license', licenseRoutes);
router.use('/subscription', subscriptionRoutes);
router.use('/project', projectRoutes);
router.use('/chat', chatRoutes);

// Debug endpoint to check environment variables (remove in production)
router.get('/debug', (req, res) => {
  const debugInfo = {
    environmentVariables: {
      HEDERA_NETWORK: process.env.HEDERA_NETWORK || '(not set)',
      AGENT_ACCOUNT_ID: process.env.AGENT_ACCOUNT_ID ? 'Set' : '(not set)',
      AGENT_PRIVATE_KEY: process.env.AGENT_PRIVATE_KEY ? 'Set (redacted)' : '(not set)',
      AGENT_INBOUND_TOPIC_ID: process.env.AGENT_INBOUND_TOPIC_ID || '(not set)',
      AGENT_OUTBOUND_TOPIC_ID: process.env.AGENT_OUTBOUND_TOPIC_ID || '(not set)',
      AGENT_PROFILE_TOPIC_ID: process.env.AGENT_PROFILE_TOPIC_ID || '(not set)',
    },
    timestamp: new Date().toISOString()
  };
  
  res.json(debugInfo);
});

// For backward compatibility, redirect old endpoints
router.use('/auth', subscriptionRoutes);
router.use('/smartapp', subscriptionRoutes);

export default router; 