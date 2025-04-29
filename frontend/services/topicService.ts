import { NftMetadata } from './licenseService';

export interface TopicMessage {
  sequenceNumber: string;
  consensusTimestamp: string;
  topicId: string;
  message: string;
  runningHash: string;
  type?: string;
  content?: any;
}

// Cache for topic messages to avoid redundant API calls
interface MessageCache {
  [topicId: string]: {
    messages: TopicMessage[];
    timestamp: number;
  }
}

const CACHE_EXPIRATION = 5 * 60 * 1000;
const topicMessagesCache: MessageCache = {};

/**
 * Gets topic messages, using cache if available
 * @param topicId The topic ID to get messages for
 * @returns The topic messages
 */
export async function getTopicMessages(topicId: string): Promise<{
  success: boolean;
  messages?: TopicMessage[];
  error?: string;
}> {
  const now = Date.now();
  const cachedData = topicMessagesCache[topicId];
  
  // Use cache if available and not expired
  if (cachedData && (now - cachedData.timestamp < CACHE_EXPIRATION)) {
    console.log(`Using cached messages for topic ${topicId}`);
    return { success: true, messages: cachedData.messages };
  }
  
  // Fetch fresh data
  try {
    const response = await fetch(`/api/topic?topicId=${topicId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch topic messages');
    }
    
    const result = await response.json();
    
    if (result.success && result.messages) {
      // Store in cache
      topicMessagesCache[topicId] = {
        messages: result.messages,
        timestamp: now
      };
      
      return { success: true, messages: result.messages };
    } else {
      throw new Error(result.error || 'No messages found');
    }
  } catch (error: any) {
    console.error('Error fetching topic messages:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Clear the topic messages cache
 * @param topicId Optional topic ID to clear specific cache
 */
export function clearTopicMessagesCache(topicId?: string) {
  if (topicId) {
    delete topicMessagesCache[topicId];
  } else {
    // Clear all cache
    Object.keys(topicMessagesCache).forEach(key => {
      delete topicMessagesCache[key];
    });
  }
}

/**
 * Create a new topic with metadata
 * @param metadata The metadata for the topic
 * @returns The created topic ID
 */
export async function createTopic(metadata: NftMetadata): Promise<string> {
  try {
    const response = await fetch(`/api/topic?action=create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ metadata }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create topic');
    }
    
    const result = await response.json();
    
    if (result.success && result.topicId) {
      return result.topicId;
    } else {
      throw new Error(result.error || 'Failed to get topic ID');
    }
  } catch (error: any) {
    console.error('Error creating topic:', error);
    throw error;
  }
}

export default {
  getTopicMessages,
  clearTopicMessagesCache,
  createTopic
}; 