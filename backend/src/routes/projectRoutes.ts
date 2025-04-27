import express, { Request, Response } from 'express';
import { createProjectTopic, recordProjectToLicense } from '../services/projectService';

const router = express.Router();

// Route to create a new project topic
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { projectName, ownerAccountId, usageQuota } = req.body;
    
    if (!projectName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Project name is required' 
      });
    }
    
    console.log(`Creating new project topic for ${projectName}`);
    
    // Create the project topic
    const topicId = await createProjectTopic(
      projectName, 
      ownerAccountId, 
      usageQuota || 3
    );
    
    return res.status(200).json({ 
      success: true, 
      topicId 
    });
  } catch (error: any) {
    console.error('Error creating project topic:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create project topic' 
    });
  }
});

// Route to record a project to a license
router.post('/record', async (req: Request, res: Response) => {
  try {
    const { 
      licenseTopicId, 
      projectTopicId, 
      accountId, 
      projectName, 
      timestamp,
      usageQuota
    } = req.body;
    
    if (!licenseTopicId) {
      return res.status(400).json({ 
        success: false, 
        error: 'License topic ID is required' 
      });
    }
    
    if (!projectTopicId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Project topic ID is required' 
      });
    }
    
    if (!accountId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Account ID is required' 
      });
    }
    
    if (!projectName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Project name is required' 
      });
    }
    
    console.log(`Recording project ${projectTopicId} to license ${licenseTopicId}`);
    
    // Record the project to the license
    const transactionId = await recordProjectToLicense(
      licenseTopicId,
      projectTopicId,
      accountId,
      projectName,
      timestamp || new Date().toISOString(),
      usageQuota
    );
    
    return res.status(200).json({ 
      success: true, 
      transactionId 
    });
  } catch (error: any) {
    console.error('Error recording project to license:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to record project to license' 
    });
  }
});

export default router; 