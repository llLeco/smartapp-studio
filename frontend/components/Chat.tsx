import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import ReactMarkdown from 'react-markdown';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/prism';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import MessagePaymentModal from './MessagePaymentModal';
import { useWallet } from '../hooks/useWallet';
import { getSubscriptionDetails } from '../services/subscriptionService';
import { getUserLicense } from '../services/licenseService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Interface for messages from the Hedera topic
interface TopicMessage {
  id: string;
  question: string;
  answer: string;
  timestamp: string;
  usageQuota?: number;
}

// Interface for pinned items
interface PinnedItem {
  id: string;
  type: 'code' | 'link';
  content: string;
  language?: string;
  title: string;
  url?: string;
  autoDetected?: boolean;
  importance?: number; // Higher value means more important
}

export interface ChatProps {
  generatedStructure: string | null;
  setPinnedItems?: (items: PinnedItem[]) => void;
}

const Chat: React.FC<ChatProps> = ({ generatedStructure, setPinnedItems }) => {
  const { accountId, isConnected } = useWallet();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { topicId } = router.query;
  const [localPinnedItems, setLocalPinnedItems] = useState<PinnedItem[]>([]);
  // Token ID from environment variable
  const [tokenId] = useState(process.env.NEXT_PUBLIC_HSUITE_TOKEN_ID || '0.0.2203022');
  // Estado para armazenar o receiver account ID que virá da API
  const [receiverAccountId, setReceiverAccountId] = useState<string | null>(null);
  // State for tracking subscription status
  const [hasActiveSubscription, setHasActiveSubscription] = useState<boolean>(false);
  const [checkingSubscription, setCheckingSubscription] = useState<boolean>(false);
  const [licenseTopicId, setLicenseTopicId] = useState<string | null>(null);
  // State to track current usage quota
  const [currentUsageQuota, setCurrentUsageQuota] = useState<number>(0); // Start with zero, no messages allowed until we verify quota
  const [showQuotaAlert, setShowQuotaAlert] = useState<boolean>(false);

  // Fetch operator ID when component mounts
  useEffect(() => {
    const fetchOperatorId = async () => {
      try {
        const operatorRes = await fetch('/api/hedera?type=network');
        const operatorData = await operatorRes.json();

        if (!operatorData.success || !operatorData.operatorId) {
          throw new Error('Operator ID not available');
        }

        setReceiverAccountId(operatorData.operatorId);
      } catch (error) {
        console.error('Error fetching Operator ID:', error);
      }
    };
    
    fetchOperatorId();
  }, []);

  // Function to check subscription status
  const checkSubscriptionStatus = async () => {
    if (!accountId) return;
    
    try {
      setCheckingSubscription(true);

      const license = await getUserLicense(accountId);
      const response = await getSubscriptionDetails(license.topicId);
      
      // Update subscription status
      setHasActiveSubscription(response.active || false);
      
      // Update license topic ID if available
      if (response.subscription?.subscriptionId) {
        setLicenseTopicId(response.subscription.subscriptionId);
      }
      
      if (!response.active && response.error) {
        console.warn('Subscription not active:', response.error);
      }
    } catch (err) {
      console.error('Error checking subscription status:', err);
      setHasActiveSubscription(false);
    } finally {
      setCheckingSubscription(false);
    }
  };

  // Check subscription status when component mounts
  useEffect(() => {
    if (accountId) {
      checkSubscriptionStatus();
    }
  }, [accountId]);

  useEffect(() => {
    // Carregar mensagens se houver um topicId
    if (topicId) {
      loadMessagesFromTopic(topicId as string);
    }
  }, [topicId]);

  // Process all existing messages to extract useful content when messages change
  useEffect(() => {
    if (messages.length > 0) {
      console.log("🔍 Processing all messages for useful content");
      const items: PinnedItem[] = [];
      
      // Process each message from assistant
      messages.forEach(message => {
        if (message.role === 'assistant') {
          // Get items from this message
          const messageItems = extractUsefulContent(message.content);
          // Add to overall items array
          items.push(...messageItems);
        }
      });
      
      console.log(`🔍 Found ${items.length} total items from all messages`);
      
      // Update local state
      setLocalPinnedItems(items);
      
      // Also update parent component if the function is provided
      if (setPinnedItems) {
        setPinnedItems(items);
      }
    }
  }, [messages, setPinnedItems]);

  const loadMessagesFromTopic = async (topicId: string) => {
    try {
      setIsLoadingHistory(true);
      console.log(`Carregando mensagens do tópico: ${topicId}`);
      
      // Fetch messages from the API
      const response = await fetch(`/api/chat?topicId=${topicId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.messages && Array.isArray(data.messages)) {
        // Convert topic messages to chat messages format
        const chatMessages: Message[] = [];
        
        // Sort messages by timestamp (oldest first)
        const sortedMessages = [...data.messages].sort((a: TopicMessage, b: TopicMessage) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        console.log("🔍 Sorted messages:", sortedMessages);
        
        // Get the most recent quota from any message type
        let foundQuota = false;
        let mostRecentQuota = 0;
        
        // First scan for quota updates in reverse order (newest first)
        for (let i = sortedMessages.length - 1; i >= 0 && !foundQuota; i--) {
          const msg = sortedMessages[i];
          console.log(`🔍 Checking message ${i} for quota:`, msg.id, msg.usageQuota);
          
          if (msg.usageQuota !== undefined && msg.usageQuota !== null) {
            console.log(`🔍 Found quota in message ${msg.id}: ${msg.usageQuota}`);
            mostRecentQuota = msg.usageQuota;
            foundQuota = true;
          }
        }
        
        if (foundQuota) {
          setCurrentUsageQuota(mostRecentQuota);
          console.log(`🔍 Found and set current usage quota: ${mostRecentQuota}`);
        } else if (sortedMessages.length <= 2) {
          // This might be a new topic - we should check with backend about initializing quota
          console.log("🔍 This appears to be a new topic, may need initial quota");
          // Default to 10 messages as in the backend logic for new topics
          setCurrentUsageQuota(10);
        } else {
          console.log("🔍 No valid usage quota found in any messages");
          setCurrentUsageQuota(0);
        }
        
        // Filter out quota-only messages before displaying
        const displayMessages = sortedMessages.filter(msg => !msg.id.toString().startsWith('quota-'));
        
        // Convert each topic message to two chat messages (user and assistant)
        displayMessages.forEach((msg: TopicMessage, index: number) => {
          // Add user message with unique index to prevent duplicate keys
          chatMessages.push({
            id: `user-${msg.id}-${index}`,
            role: 'user',
            content: msg.question,
            timestamp: new Date(msg.timestamp)
          });
          
          // Add assistant message with unique index to prevent duplicate keys
          chatMessages.push({
            id: `assistant-${msg.id}-${index}`,
            role: 'assistant',
            content: msg.answer,
            timestamp: new Date(msg.timestamp)
          });
        });
        
        // Update state with loaded messages
        setMessages(chatMessages);
        
        console.log(`Loaded ${chatMessages.length} messages from topic ${topicId}`);
      } else {
        // If no messages were found, add a welcome message
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: `Welcome to the chat for the project with topicId: ${topicId}. How can I help you today?`,
            timestamp: new Date()
          }
        ]);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      // Add a welcome message on error
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Welcome to the chat. There was an error loading the history, but we can continue the conversation.`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const saveMessageToTopic = async (message: Message, usageQuota?: number) => {
    if (!topicId) return;

    console.log('DEBUG CHAT: saveMessageToTopic called', message, usageQuota);
    
    try {
      // Send message to backend with current usage quota
      console.log('DEBUG CHAT: Making API call to /api/chat with', { message: message.content, topicId, usageQuota });
      const response = await fetch(`/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.content,
          topicId,
          usageQuota: usageQuota !== undefined ? usageQuota : currentUsageQuota
        }),
      });

      if (!response.ok) {
        console.log('DEBUG CHAT: API call failed with status', response.status);
        const errorData = await response.json();
        console.log('DEBUG CHAT: Error details', errorData);
        throw new Error(errorData.error || 'Failed to save message');
      }

      const data = await response.json();
      console.log('DEBUG CHAT: API response received', data);

      if (data.usageQuota !== undefined) {
        console.log('DEBUG CHAT: Updating usage quota from', currentUsageQuota, 'to', data.usageQuota);
        setCurrentUsageQuota(data.usageQuota);
      }

      return data.response;
    } catch (error) {
      console.error('DEBUG CHAT: Error in saveMessageToTopic:', error);
      console.error('Error saving message:', error);
      throw error; // Re-throw the error to be handled by the caller
    }
  };

  // Function to extract useful content from a message (doesn't save to localStorage)
  const extractUsefulContent = (content: string): PinnedItem[] => {
    console.log("🔍 Extracting useful content");
    console.log("🔍 Content type:", typeof content);
    console.log("🔍 Content length:", content?.length);
    
    // Safety check for content
    if (!content || typeof content !== 'string' || content.length === 0) {
      console.error("🔴 Invalid content provided to extractUsefulContent:", content);
      return [];
    }
    
    try {
      const items: PinnedItem[] = [];
      let codeBlocksFound = 0;
      let linksFound = 0;
      let urlsFound = 0;
      
      // Debugging the content looking for code blocks
      console.log("🔍 Content includes '```':", content.includes("```"));
      if (content.includes("```")) {
        console.log("🔍 Position of first code block:", content.indexOf("```"));
        const parts = content.split("```");
        console.log("🔍 Number of parts after splitting by ```:", parts.length);
      }
      
      // 1. Detect code blocks - using more robust regex
      const codeBlockRegex = /```(\w*)\n?([\s\S]+?)```/g;
      let codeMatch;
      
      // Manual test of regex
      const testMatches = [];
      let testMatch;
      while ((testMatch = codeBlockRegex.exec(content.slice())) !== null) {
        testMatches.push(testMatch);
      }
      console.log("🔍 Code block match test results:", testMatches);
      
      while ((codeMatch = codeBlockRegex.exec(content)) !== null) {
        codeBlocksFound++;
        const language = codeMatch[1].trim() || "text";
        const code = codeMatch[2].trim();
        
        console.log(`🔍 CODE BLOCK #${codeBlocksFound} FOUND!`);
        console.log(`🔍 Language: "${language}"`);
        console.log(`🔍 Code preview: "${code.substring(0, 50)}..."`);
        
        // Add code block
        const newItem = {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          type: 'code' as 'code',
          content: code,
          language,
          title: `${language.charAt(0).toUpperCase() + language.slice(1)} Snippet ${codeBlocksFound}`,
          autoDetected: true
        };
        
        console.log("🔍 Adding new code block item:", newItem);
        items.push(newItem);
      }
      
      // 2. Detect links with markdown format
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let linkMatch;
      
      while ((linkMatch = linkRegex.exec(content)) !== null) {
        linksFound++;
        const linkText = linkMatch[1];
        const url = linkMatch[2];
        
        console.log(`🔍 MARKDOWN LINK #${linksFound} FOUND!`);
        console.log(`🔍 Link text: "${linkText}"`);
        console.log(`🔍 URL: "${url}"`);
        
        const newItem = {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          type: 'link' as 'link',
          content: url,
          title: linkText,
          url,
          autoDetected: true
        };
        
        console.log("🔍 Adding new markdown link item:", newItem);
        items.push(newItem);
      }
      
      // 3. Look for plain URLs in text
      const urlRegex = /(https?:\/\/[^\s'")<>]+)/g;
      let urlMatch;
      
      while ((urlMatch = urlRegex.exec(content)) !== null) {
        urlsFound++;
        const url = urlMatch[1];
        
        // Skip markdown URLs we already processed
        if (content.includes(`](${url})`)) {
          continue;
        }
        
        console.log(`🔍 PLAIN URL #${urlsFound} FOUND!`);
        console.log(`🔍 URL: "${url}"`);
        
        // Try to get domain as title
        let title;
        try {
          const urlObj = new URL(url);
          title = urlObj.hostname.replace('www.', '');
        } catch {
          title = 'Link';
        }
        
        const newItem = {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          type: 'link' as 'link',
          content: url,
          title,
          url,
          autoDetected: true
        };
        
        console.log("🔍 Adding new plain URL item:", newItem);
        items.push(newItem);
      }
      
      console.log(`🔍 DETECTION SUMMARY: ${codeBlocksFound} code blocks, ${linksFound} markdown links, ${urlsFound} plain URLs`);
      return items;
      
    } catch (error) {
      console.error('🔴 ERROR in extractUsefulContent:', error);
      return [];
    }
  };

  // Function to auto-detect useful content from an assistant message
  const processNewMessage = (content: string) => {
    console.log("🔍 Processing new message for useful content");
    
    // Extract items from the new message
    const newItems = extractUsefulContent(content);
    
    if (newItems.length > 0) {
      // Combine with existing items
      const updatedItems = [...localPinnedItems, ...newItems];
      
      // Update local state
      setLocalPinnedItems(updatedItems);
      
      // Also update parent component if the function is provided
      if (setPinnedItems) {
        setPinnedItems(updatedItems);
      }
      
      console.log(`🔍 Added ${newItems.length} new items, total: ${updatedItems.length}`);
    }
  };

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (input.trim() === '') return;
    
    console.log('DEBUG CHAT: handleSendMessage called with input:', input);
    
    // Check subscription status first
    if (!hasActiveSubscription) {
      console.log('DEBUG CHAT: No active subscription, showing payment modal');
      setShowPaymentModal(true);
      return;
    }
    
    // Check for remaining quota
    if (currentUsageQuota <= 0) {
      console.log('DEBUG CHAT: No quota available, showing notification');
      setMessages(prevMessages => [
        ...prevMessages,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'You do not have quota available for this topic. Please update your subscription or contact support.',
          timestamp: new Date()
        }
      ]);
      return;
    }
    
    // Create a new user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    
    console.log("DEBUG CHAT: Created user message:", userMessage);
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      console.log("DEBUG CHAT: Calling saveMessageToTopic with quota:", currentUsageQuota);
      // Save user message with current quota
      const response = await saveMessageToTopic(userMessage, currentUsageQuota);
      
      console.log("DEBUG CHAT: Received response from saveMessageToTopic:", response);

      // Check if we got a valid response
      if (!response) {
        throw new Error("Received empty response from AI");
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };
      
      console.log("DEBUG CHAT: Created assistant message:", assistantMessage.id);
      setMessages(prevMessages => [...prevMessages, assistantMessage]);
      
      // Save assistant message with decremented quota
      const newQuota = Math.max(0, currentUsageQuota - 1);
      // await saveMessageToTopic(assistantMessage, newQuota);
      
      // Update local quota
      setCurrentUsageQuota(newQuota);
      console.log("DEBUG CHAT: Updated local quota to:", newQuota);
      
      // Process new message for useful content
      processNewMessage(response);
      
    } catch (error) {
      console.error('DEBUG CHAT: Error in handleSendMessage:', error);
      console.error('🔴 Error getting response:', error);
      
      // Add error message
      setMessages(prevMessages => [
        ...prevMessages,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Sorry, an error occurred while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Custom components for markdown rendering without pin buttons
  const markdownComponents = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const code = String(children).replace(/\n$/, '');
      
      return !inline && match ? (
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {code}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    a({ node, children, href, ...props }: any) {
      return (
        <a 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
          {...props}
        >
          {children}
        </a>
      );
    }
  };

  // Handle purchase more quota
  const handlePurchaseMoreQuota = () => {
    setShowPaymentModal(true);
  };

  // Handle payment confirmation
  const handlePaymentConfirm = async (transactionId: string, messageCount: number) => {
    setShowPaymentModal(false);
    console.log(`Payment confirmed! Transaction ID: ${transactionId}, Message count: ${messageCount}`);

    try {
      if (!topicId) {
        throw new Error('Topic ID is required to update quota');
      }

      // Send transaction details to backend to update quota
      const response = await fetch('/api/chat/quota', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topicId,
          transactionId,
          messageCount: parseInt(messageCount.toString(), 10) // Ensure it's a number
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Failed to update quota');
      }

      const data = await response.json();
      console.log('Quota updated successfully:', data);
      
      // Update local quota state with new quota from response
      if (data.newQuota !== undefined) {
        setCurrentUsageQuota(data.newQuota);
        console.log(`Updated quota to ${data.newQuota}`);
      } else {
        // If no specific quota returned, add the message count to current quota
        setCurrentUsageQuota(prev => prev + messageCount);
        console.log(`Updated quota by adding ${messageCount}`);
      }
    } catch (error) {
      console.error('Error updating quota:', error);
      // Show error toast or notification here
    }

    // Refresh subscription status to reflect new quota
    checkSubscriptionStatus();
  };

  // Effect to handle quota alerts
  useEffect(() => {
    if (currentUsageQuota <= 0 && !isLoadingHistory && messages.length > 0) {
      setShowQuotaAlert(true);
    } else {
      setShowQuotaAlert(false);
    }
  }, [currentUsageQuota, isLoadingHistory, messages.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-custom">
        {isLoadingHistory ? (
          <div className="flex flex-col items-center justify-center h-full text-white/60">
            <div className="animate-pulse flex space-x-2">
              <div className="h-3 w-3 bg-indigo-500 rounded-full"></div>
              <div className="h-3 w-3 bg-indigo-500 rounded-full"></div>
              <div className="h-3 w-3 bg-indigo-500 rounded-full"></div>
            </div>
            <p className="mt-3 text-center">Loading message history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/60 pt-16">
            <svg className="w-12 h-12 mb-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="text-center max-w-sm">
              Send a message to start a conversation with our AI.
            </p>
          </div>
        ) : (
          <div className="space-y-4 pb-2">
            {messages.map((message) => (
              <div 
                key={message.id}
                className={`message flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[80%] px-4 py-3 rounded-xl ${
                    message.role === 'user' 
                      ? 'bg-indigo-600/80 text-white' 
                      : 'bg-gray-700/80 text-gray-100'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert break-words max-w-none">
                      <ReactMarkdown components={markdownComponents}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert break-words">
                      {message.content}
                    </div>
                  )}
                  <div className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-indigo-200/70' : 'text-gray-400'
                  }`}>
                    {message.timestamp.toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={endOfMessagesRef} />
          </div>
        )}
        
        {isLoading && (
          <div className="flex justify-start mt-2">
            <div className="bg-gray-700/80 text-white px-4 py-3 rounded-xl">
              <div className="flex items-center space-x-2">
                <div className="typing-dot"></div>
                <div className="typing-dot delay-75"></div>
                <div className="typing-dot delay-150"></div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="px-4 py-2 border-t border-white/10">
        {/* Quota status indicator */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center text-xs">
            <span className="text-white/60 mr-2">Messages remaining:</span>
            <span className={`font-medium ${currentUsageQuota > 0 ? 'text-green-400' : 'text-amber-400'}`}>
              {currentUsageQuota > 0 ? currentUsageQuota : '0'}
            </span>
          </div>
          
          {currentUsageQuota <= 0 && (
            <button 
              onClick={handlePurchaseMoreQuota}
              className="text-xs text-amber-400 hover:text-amber-300 underline"
            >
              Buy more messages
            </button>
          )}
        </div>
        
        <div className="flex items-end space-x-2">
          <textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasActiveSubscription ? "Type your message..." : "Subscribe to send messages..."}
            className="flex-1 bg-white/10 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none min-h-[50px] max-h-[100px]"
            rows={2}
            disabled={!hasActiveSubscription || checkingSubscription || currentUsageQuota <= 0}
          />
          <button
            onClick={currentUsageQuota <= 0 ? handlePurchaseMoreQuota : (hasActiveSubscription ? handleSendMessage : () => setShowPaymentModal(true))}
            disabled={isLoading || input.trim() === '' || checkingSubscription}
            className={`${
              currentUsageQuota <= 0 
                ? 'bg-amber-600 hover:bg-amber-700' 
                : (hasActiveSubscription ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-600 hover:bg-amber-700')
            } text-white rounded-lg px-4 py-2 h-10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {currentUsageQuota <= 0 ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : hasActiveSubscription ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>
        </div>
        
        {!hasActiveSubscription && !checkingSubscription && (
          <div className="mt-2 text-center text-sm text-amber-400">
            You need an active subscription to send messages
          </div>
        )}
        
        {hasActiveSubscription && currentUsageQuota <= 0 && (
          <div className="mt-2 text-center text-sm text-amber-400">
            You need to purchase more messages to continue this conversation
          </div>
        )}
      </div>
      
      {/* Payment modal */}
      {showPaymentModal && (
        <MessagePaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={handlePaymentConfirm}
          tokenId={tokenId}
          receiverAccountId={receiverAccountId || ''}
        />
      )}
    </div>
  );
};

export default Chat; 

function getSigner(accountId: string) {
  throw new Error('Function not implemented.');
}
