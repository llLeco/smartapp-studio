// Set up backend URL
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const api = (path: string) => `${BACKEND_URL}${path.startsWith('/') ? path : '/' + path}`;

import { getUserLicense } from './licenseService';
import { getTopicMessages } from './topicService';

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
  expired: boolean;
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
  active?: boolean;
  error?: string;
}> {
  try {
    // Use the shared message cache from licenseService
    const data = await getTopicMessages(topicId);
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch subscription details');
    }
    
    // Extract subscription details from topicMessages response
    if (data.success && data.messages && data.messages.length > 0) {
      // Filter all subscription messages
      const subscriptionMessages = data.messages.filter(
        (message: any) => message.type === 'SUBSCRIPTION_CREATED' || (message.content && message.content.type === 'SUBSCRIPTION_CREATED')
      );
      
      // If we have subscription messages, get the most recent one
      if (subscriptionMessages.length > 0) {
        // Sort by timestamp (newest first)
        subscriptionMessages.sort((a: any, b: any) => {
          const timeA = a.content?.timestamp ? new Date(a.content.timestamp).getTime() : 0;
          const timeB = b.content?.timestamp ? new Date(b.content.timestamp).getTime() : 0;
          return timeB - timeA;
        });
        
        const subscriptionData = subscriptionMessages[0].content || {};
        console.log('Using most recent subscription from:', subscriptionData.timestamp);
        
        const now = new Date();
        const expiresAt = new Date(subscriptionData.expiresAt);
        const active = now < expiresAt && subscriptionData.status === 'active';
        
        return {
          success: true,
          subscription: subscriptionData as SubscriptionDetails,
          active: active
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
  // Check if subscription is expired
  const now = new Date();
  const expiresAt = new Date(details.expiresAt);
  const isExpired = now > expiresAt;
  
  return {
    active: details.status === 'active' && !isExpired,
    expired: isExpired,
    expiresAt: details.expiresAt,
    projectLimit: details.projectLimit,
    messageLimit: details.messageLimit,
    projectsUsed: projectsUsed,
    messagesUsed: 0 // This would need to be calculated elsewhere
  };
}