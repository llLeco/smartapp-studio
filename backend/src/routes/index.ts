import express from 'express';
import hederaRoutes from './hederaRoutes';
import topicRoutes from './topicRoutes';
import licenseRoutes from './licenseRoutes';
import subscriptionRoutes from './subscriptionRoutes';
import projectRoutes from './projectRoutes';
import chatRoutes from './chatRoutes';

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