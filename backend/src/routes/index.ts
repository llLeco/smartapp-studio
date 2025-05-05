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

// For backward compatibility, redirect old endpoints
router.use('/auth', subscriptionRoutes);
router.use('/smartapp', subscriptionRoutes);

export default router; 