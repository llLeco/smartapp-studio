// frontend/services/projectService.ts

import { getTopicMessages } from './topicService';

// --- Configuration ---
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";
function api(path: string) {
  return `${BACKEND_URL}${path.startsWith("/") ? path : "/" + path}`;
}

// --- Types ---
export interface Project {
  projectTopicId: string;
  projectName: string;
  createdAt: string;
  ownerAccountId: string;
  usageQuota?: number;
}

/**
 * Create a new project
 * @param projectName The name of the project
 * @param ownerAccountId The account ID of the project owner
 * @param usageQuota The usage quota for the project (default: 3)
 * @returns Information about the created project
 */
export async function createProject(
  projectName: string,
  ownerAccountId: string,
  ownerLicenseTopicId: string,
  usageQuota: number = 3
): Promise<{
  success: boolean;
  projectTopicId?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`/api/project?action=create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectName,
        ownerAccountId,
        usageQuota
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create project');
    }
    
    const result = await response.json();
    
    if (result.success && result.topicId) {
      // Record the project to the license
      const recordResult = await recordProjectToLicense(
        ownerLicenseTopicId,
        result.topicId,
        ownerAccountId,
        projectName,
        usageQuota
      );
      
      if (!recordResult.success) {
        throw new Error(recordResult.error || 'Failed to record project to license');
      }
      
      return {
        success: true,
        projectTopicId: result.topicId
      };
    } else {
      throw new Error(result.error || 'Failed to get project topic ID');
    }
  } catch (error: any) {
    console.error('Error creating project:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Record a project to a license
 * @param licenseTopicId The license topic ID
 * @param projectTopicId The project topic ID
 * @param accountId The account ID
 * @param projectName The name of the project
 * @param usageQuota The usage quota for the project
 * @returns Success status and transaction ID
 */
export async function recordProjectToLicense(
  licenseTopicId: string,
  projectTopicId: string,
  accountId: string,
  projectName: string,
  usageQuota?: number
): Promise<{
  success: boolean;
  transactionId?: string;
  error?: string;
}> {
  try {
    const timestamp = new Date().toISOString();
    
    const response = await fetch(`/api/project?action=record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        licenseTopicId,
        projectTopicId,
        accountId,
        projectName,
        timestamp,
        usageQuota
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to record project');
    }
    
    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        transactionId: result.transactionId
      };
    } else {
      throw new Error(result.error || 'Failed to record project to license');
    }
  } catch (error: any) {
    console.error('Error recording project to license:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// /**
//  * Get projects associated with a license
//  * @param licenseTopicId The license topic ID
//  * @returns Array of projects
//  */
// export async function getProjects(licenseTopicId: string): Promise<{
//   success: boolean;
//   projects?: Project[];
//   error?: string;
// }> {
//   try {
//     // This would typically call a backend endpoint, but we're using the topic messages
//     // approach from the license service. This is a placeholder for a future implementation.
//     const topicServiceModule = await import('./topicService');
//     const result = await topicServiceModule.getTopicMessages(licenseTopicId);
    
//     if (!result.success) {
//       throw new Error(result.error || 'Failed to get license topic messages');
//     }
    
//     // Filter for PROJECT_RECORDED messages
//     const projectMessages = result.messages?.filter(
//       msg => msg.type === 'PROJECT_RECORDED' || 
//              (msg.content && msg.content.type === 'PROJECT_RECORDED')
//     ) || [];
    
//     // Extract project information
//     const projects = projectMessages.map(msg => {
//       const content = msg.content || JSON.parse(msg.message);
//       return {
//         projectTopicId: content.projectTopicId,
//         projectName: content.projectName,
//         createdAt: content.timestamp || msg.consensusTimestamp,
//         ownerAccountId: content.accountId,
//         usageQuota: content.usageQuota
//       };
//     });
    
//     return {
//       success: true,
//       projects
//     };
//   } catch (error: any) {
//     console.error('Error getting projects:', error);
//     return {
//       success: false,
//       error: error.message
//     };
//   }
// }

export async function getUserProjects(licenseTopic: string): Promise<Project[]> {
  try {
    // Get all messages from the license topic using the cached function
    const { success, messages, error } = await getTopicMessages(licenseTopic);
    
    if (!success || !messages) {
      throw new Error(error || 'Failed to fetch topic messages');
    }
    
    // Filter messages to find project creation messages
    const projectMessages = messages.filter((msg: any) => 
      msg.content && msg.content.type === 'PROJECT_CREATED'
    );
    
    // Extract project data from messages
    const projects: Project[] = projectMessages.map((msg: any) => ({
      projectTopicId: msg.content.projectTopicId,
      projectName: msg.content.projectName,
      createdAt: msg.content.createdAt,
      ownerAccountId: msg.content.ownerAccountId,
      usageQuota: msg.content.usageQuota
    }));
    
    console.log(`Found ${projects.length} projects for license topic ${licenseTopic}`);
    return projects;
  } catch (error: any) {
    console.error('Error fetching user projects:', error);
    return [];
  }
}

export default {
  createProject,
  recordProjectToLicense,
  getUserProjects
}; 