// Set up backend URL
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const api = (path: string) => `${BACKEND_URL}${path.startsWith('/') ? path : '/' + path}`;

import { getTopicMessages } from './licenseService';

/**
 * Interface for subscription details returned from API
 */
export interface SubscriptionDetails {
  subscriptionId: string;
  subscriptionDate: string;
  expiresAt: string;
  projectLimit: number;
  messageLimit: number;
  priceUSD: number;
  priceHSuite: number;
  paymentTransactionId: string;
  status: string;
  timestamp: string;
}

/**
 * Interface for subscription info with usage
 */
export interface SubscriptionInfo {
  active: boolean;
  expiresAt: string;
  projectLimit: number;
  messageLimit: number;
  projectsUsed: number;
  messagesUsed: number;
}

/**
 * Fetches subscription details for a license topic
 * @param topicId The license topic ID
 * @returns The subscription details
 */
export async function getSubscriptionDetails(topicId: string): Promise<{
  success: boolean;
  subscription?: SubscriptionDetails;
  error?: string;
}> {
  try {
    // Use the shared message cache from licenseService
    const data = await getTopicMessages(topicId);
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch subscription details');
    }
    
    // Extract subscription details from topicMessages response
    if (data.success && data.data && data.data.length > 0) {
      const subscriptionMessage = data.data.find(
        (message: any) => message.type === 'SUBSCRIPTION_CREATED' || 
                          (message.content && message.content.type === 'SUBSCRIPTION_CREATED')
      );
      
      if (subscriptionMessage) {
        const subscriptionData = subscriptionMessage.content || {};
        return {
          success: true,
          subscription: subscriptionData as SubscriptionDetails
        };
      }
    }
    
    return {
      success: false,
      error: 'No subscription found for this topic'
    };
  } catch (error: any) {
    console.error('Error fetching subscription details:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch subscription details'
    };
  }
}

/**
 * Converts API subscription details to frontend subscription info
 * @param details API subscription details
 * @param projectsUsed Number of projects used
 * @returns Frontend subscription info
 */
export function mapSubscriptionToInfo(details: SubscriptionDetails, projectsUsed: number = 0): SubscriptionInfo {
  return {
    active: details.status === 'active',
    expiresAt: details.expiresAt,
    projectLimit: details.projectLimit,
    messageLimit: details.messageLimit,
    projectsUsed: projectsUsed,
    messagesUsed: 0 // This would need to be calculated elsewhere
  };
} 