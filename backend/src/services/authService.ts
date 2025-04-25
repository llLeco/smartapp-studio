import { TopicId, PrivateKey } from "@hashgraph/sdk";
import { Client } from "@hashgraph/sdk";
import { getTopicMessages } from "./hederaService";

/**
 * Interface for subscription details
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
 * Interface for subscription verification response
 */
export interface SubscriptionVerificationResponse {
  success: boolean;
  subscription?: SubscriptionDetails;
  error?: string;
}

/**
 * Gets the current subscription details from a license topic
 * @param licenseTopicId The license topic ID to check
 * @returns Subscription verification response with details if valid
 */
export async function getSubscriptionDetails(licenseTopicId: string): Promise<SubscriptionVerificationResponse> {
  try {
    // Get messages from the license topic
    const messages = await getTopicMessages(licenseTopicId);
    
    // Find the most recent subscription message
    const subscriptionMessages = messages.filter(msg => 
      msg.content && msg.content.type === 'SUBSCRIPTION_CREATED'
    );
    
    if (subscriptionMessages.length === 0) {
      return {
        success: false,
        error: 'No subscription found for this license'
      };
    }
    
    // Sort by timestamp to get the most recent subscription
    subscriptionMessages.sort((a, b) => 
      new Date(b.content.timestamp).getTime() - new Date(a.content.timestamp).getTime()
    );
    
    const latestSubscription = subscriptionMessages[0].content;
    
    // Check if subscription is expired
    const now = new Date();
    const expiresAt = new Date(latestSubscription.expiresAt);
    
    if (now > expiresAt) {
      return {
        success: false,
        error: 'Subscription has expired'
      };
    }
    
    // Check if subscription is active
    if (latestSubscription.status !== 'active') {
      return {
        success: false,
        error: 'Subscription is not active'
      };
    }
    
    return {
      success: true,
      subscription: latestSubscription as SubscriptionDetails
    };
  } catch (error: any) {
    console.error('Error getting subscription details:', error);
    return {
      success: false,
      error: error.message || 'Failed to get subscription details'
    };
  }
} 