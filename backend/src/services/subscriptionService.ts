import { PrivateKey, TopicMessageSubmitTransaction, TopicId } from "@hashgraph/sdk";
import { Client } from "@hashgraph/sdk";
import { getTopicMessages } from "./topicService.js";

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
 * Records subscription information to a user's license topic
 * @param licenseTopicId The user's license topic ID
 * @param paymentTransactionId The transaction ID of the payment
 * @param subscription Details of the subscription
 * @returns Information about the subscription operation
 */
export async function recordSubscriptionToTopic(
  licenseTopicId: string, 
  paymentTransactionId: string,
  subscription: SubscriptionDetails
): Promise<{
  success: boolean;
  error?: string;
  subscriptionId?: string;
  expiresAt?: string;
}> {
  try {
    console.log(`Recording subscription to license topic ${licenseTopicId}`);
    
    // Verify the payment transaction ID
    if (!paymentTransactionId) {
      return { success: false, error: 'Payment transaction ID is required' };
    }
    
    // Verify transaction on the Hedera mirror node
    try {
      const network = process.env.HEDERA_NETWORK || 'testnet';
      const mirrorNodeUrl = {
        mainnet: "https://mainnet-public.mirrornode.hedera.com",
        testnet: "https://testnet.mirrornode.hedera.com",
        previewnet: "https://previewnet.mirrornode.hedera.com"
      };
      
      const baseUrl = mirrorNodeUrl[network as keyof typeof mirrorNodeUrl];
      
      // Extract account ID from the transaction ID
      const accountId = paymentTransactionId.split('@')[0];
      console.log(`Verifying payment from account: ${accountId}`);
      
      // Format the transaction timestamp for filtering
      let timestamp = '';
      if (paymentTransactionId.includes('@')) {
        timestamp = paymentTransactionId.split('@')[1];
      }
      
      // Look up recent transactions for this account
      const url = `${baseUrl}/api/v1/transactions?account.id=${accountId}&limit=10&order=desc`;
      console.log(`Checking account transactions: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to query transactions: ${response.status}`);
      }
      
      const txData = await response.json();
      console.log(`Found ${txData.transactions?.length || 0} recent transactions`);
      
      // Look for our specific transaction
      let found = false;
      if (txData.transactions && txData.transactions.length > 0) {
        // Format the transaction ID used in the response
        const transactionIdToFind = timestamp ? 
          `${accountId}-${timestamp.replace('.', '-')}` : 
          null;
          
        // Find matching transaction
        for (const tx of txData.transactions) {
          if (tx.transaction_id === transactionIdToFind || 
              (tx.token_transfers && tx.result === 'SUCCESS')) {
            found = true;
            
            if (tx.result !== 'SUCCESS') {
              return { success: false, error: `Transaction was not successful: ${tx.result}` };
            }
            
            console.log(`Verified payment transaction successfully`);
            break;
          }
        }
      }
      
      if (!found) {
        return { success: false, error: 'Payment transaction not found or not confirmed yet' };
      }
    } catch (verifyError: any) {
      console.error('Error verifying transaction:', verifyError);
      return { success: false, error: `Failed to verify payment: ${verifyError.message}` };
    }
    
    // Calculate the expiry date based on subscription period
    const subscriptionDate = new Date();
    const expiryDate = new Date(subscriptionDate);
    // expiryDate.setMonth(expiryDate.getMonth() + subscription.periodMonths);
    expiryDate.setHours(expiryDate.getHours() + 1);
    
    // Generate a unique subscription ID
    const subscriptionId = `sub-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    
    // Create subscription message content
    const messageContent = {
      type: 'SUBSCRIPTION_CREATED',
      subscriptionId,
      subscriptionDate: subscriptionDate.toISOString(),
      expiresAt: expiryDate.toISOString(),
      projectLimit: subscription.projectLimit,
      messageLimit: subscription.messageLimit,
      priceUSD: subscription.priceUSD,
      priceHSuite: subscription.priceHSuite,
      paymentTransactionId,
      status: 'active',
      timestamp: new Date().toISOString()
    };
    
    // Set up Hedera client 
    const network = process.env.HEDERA_NETWORK || 'testnet';
    const operatorId = process.env.HEDERA_OPERATOR_ID;
    const operatorKey = process.env.HEDERA_OPERATOR_KEY;
    
    if (!operatorId || !operatorKey) {
      return { success: false, error: 'Hedera credentials not configured' };
    }
    
    let client;
    switch(network) {
      case 'mainnet':
        client = Client.forMainnet();
        break;
      case 'previewnet':
        client = Client.forPreviewnet();
        break;
      default:
        client = Client.forTestnet();
    }
    
    client.setOperator(operatorId, operatorKey);
    const privateKey = PrivateKey.fromString(operatorKey);
    
    // Submit the subscription message to the license topic
    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(licenseTopicId))
      .setMessage(Buffer.from(JSON.stringify(messageContent)))
      .freezeWith(client);
    
    const signedTx = await transaction.sign(privateKey);
    const txResponse = await signedTx.execute(client);
    await txResponse.getReceipt(client);
    
    console.log(`Subscription recorded to license topic ${licenseTopicId}, expires at ${expiryDate.toISOString()}`);
    
    return {
      success: true,
      subscriptionId,
      expiresAt: expiryDate.toISOString()
    };
  } catch (error: any) {
    console.error('Error recording subscription:', error);
    return {
      success: false,
      error: error.message || 'Failed to record subscription'
    };
  }
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