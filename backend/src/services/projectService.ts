import { TopicCreateTransaction, TopicMessageSubmitTransaction } from "@hashgraph/sdk";
import { getClient } from "./hederaService.js";

/**
 * Creates a new topic for a project
 */
export const createProjectTopic = async (projectName: string, ownerAccountId?: string, usageQuota: number = 3): Promise<string> => {
    try {
      const client = getClient();
      
      const adminKey = client.operatorPublicKey;
      const submitKey = client.operatorPublicKey;
      
      // Create a new topic with transaction
      const transaction = new TopicCreateTransaction();
      
      // Only set keys if they exist
      if (adminKey) {
        transaction.setAdminKey(adminKey);
      }
      
      if (submitKey) {
        transaction.setSubmitKey(submitKey);
      }
      
      transaction.setTopicMemo(`Project: ${projectName}`);
      
      const txResponse = await transaction.execute(client);
      const receipt = await txResponse.getReceipt(client);
      const topicId = receipt.topicId!.toString();
      
      console.log(`Created new project topic ${topicId} for ${projectName} with ${usageQuota} chat messages`);
      
      // Submit initial message to the topic with message allowance information
      const messageContent = {
        type: 'PROJECT_CREATION',
        name: projectName,
        createdAt: new Date().toISOString(),
        owner: ownerAccountId || client.operatorAccountId!.toString(),
        usageQuota: usageQuota,
      };
      
      const message = new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(Buffer.from(JSON.stringify(messageContent)));
        
      await message.execute(client);
      
      return topicId;
    } catch (error) {
      console.error('Error creating project topic:', error);
      throw error;
    }
  };
  
  /**
   * Records a project reference in the license topic
   */
  export const recordProjectToLicense = async (
    licenseTopicId: string,
    projectTopicId: string,
    accountId: string,
    projectName: string,
    timestamp: string,
    usageQuota?: number
  ): Promise<string> => {
    try {
      const client = getClient();
      
      // Create the message to send
      const messageContent = {
        type: 'PROJECT_CREATED',
        projectTopicId,
        projectName,
        ownerAccountId: accountId,
        usageQuota: usageQuota || 3,
        createdAt: timestamp || new Date().toISOString()
      };
      
      // Submit the message to the topic
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(licenseTopicId)
        .setMessage(Buffer.from(JSON.stringify(messageContent)));
        
      const response = await transaction.execute(client);
      const receipt = await response.getReceipt(client);
      
      console.log(`Recorded project ${projectTopicId} in license ${licenseTopicId} with ${usageQuota || 3} chats`);
      
      // Return the transaction ID as a record of the message
      return response.transactionId.toString();
    } catch (error) {
      console.error('Error recording project to license:', error);
      throw error;
    }
  };