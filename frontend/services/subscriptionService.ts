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
  isNewSubscription?: boolean;
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
      // Filter all subscription messages
      const subscriptionMessages = data.data.filter(
        (message: any) => message.type === 'SUBSCRIPTION_CREATED' || 
                          (message.content && message.content.type === 'SUBSCRIPTION_CREATED')
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
        
        // Check if this is a new subscription (created in the last hour)
        const subscriptionTime = new Date(subscriptionData.timestamp);
        const now = new Date();
        const isNew = (now.getTime() - subscriptionTime.getTime()) <= 60 * 60 * 1000; // 1 hour
        
        if (isNew) {
          console.log('This is a new subscription, project limits will be reset');
        }
        
        return {
          success: true,
          subscription: subscriptionData as SubscriptionDetails,
          isNewSubscription: isNew
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

/**
 * Check if a user has an active subscription
 * @param accountId The Hedera account ID to check
 * @returns True if the user has an active subscription
 */
export async function checkActiveSubscription(accountId: string): Promise<{
  active: boolean;
  expired?: boolean;
  licenseTopicId?: string;
  subscription?: SubscriptionInfo;
  error?: string;
}> {
  try {
    if (!accountId) {
      return { active: false, error: 'No account ID provided' };
    }
    
    // First, get the license topic ID for the user
    const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    const licenseResponse = await fetch(`${apiUrl}/api/hedera/getUserLicense?accountId=${accountId}`);
    const licenseData = await licenseResponse.json();
    
    if (!licenseData.success || !licenseData.data?.topicId) {
      console.warn('No license found for user:', accountId);
      return { active: false, error: 'No license found for user' };
    }
    
    const userLicenseTopicId = licenseData.data.topicId;
    
    // Now get subscription details
    const result = await getSubscriptionDetails(userLicenseTopicId);
    
    if (result.success && result.subscription) {
      // Map to subscription info
      const subscriptionInfo = mapSubscriptionToInfo(result.subscription);
      
      // Check if it's active
      console.log(`Subscription status check for ${accountId}: active=${subscriptionInfo.active}, expired=${subscriptionInfo.expired}`);
      
      return {
        active: subscriptionInfo.active,
        expired: subscriptionInfo.expired,
        licenseTopicId: userLicenseTopicId,
        subscription: subscriptionInfo
      };
    } else {
      console.warn('No active subscription found for user:', accountId);
      return { 
        active: false, 
        licenseTopicId: userLicenseTopicId,
        error: result.error || 'No subscription found' 
      };
    }
  } catch (error: any) {
    console.error('Error checking subscription status:', error);
    return { active: false, error: error.message || 'Error checking subscription status' };
  }
} 