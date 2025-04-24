import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import ReactMarkdown from 'react-markdown';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/prism';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import MessagePaymentModal from './MessagePaymentModal';
import { useWallet } from '../hooks/useWallet';

// Configurar URL base do backend se necessário
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const api = (path: string) => `${BACKEND_URL}${path.startsWith('/') ? path : '/' + path}`;

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

// Interface para informações de cota de mensagens
interface MessageAllowance {
  remainingMessages: number;
  totalAllowance: number;
  messagesUsed: number;
}

export interface ChatProps {
  onSendMessage: (message: string) => Promise<string>;
  generatedStructure: string | null;
  setPinnedItems?: (items: PinnedItem[]) => void;
}

const Chat: React.FC<ChatProps> = ({ onSendMessage, generatedStructure, setPinnedItems }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [messageAllowance, setMessageAllowance] = useState<MessageAllowance | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { topicId } = router.query;
  const [localPinnedItems, setLocalPinnedItems] = useState<PinnedItem[]>([]);
  const { accountId } = useWallet();
  // Token ID from environment variable
  const [tokenId] = useState(process.env.NEXT_PUBLIC_HSUITE_TOKEN_ID || '0.0.2203022');
  // Estado para armazenar o receiver account ID que virá da API
  const [receiverAccountId, setReceiverAccountId] = useState<string | null>(null);

  // Buscar o operator ID quando o componente montar
  useEffect(() => {
    const fetchOperatorId = async () => {
      try {
        const operatorRes = await fetch(api('/api/hedera/getOperatorId'));
        const operatorData = await operatorRes.json();
        
        if (operatorData.success && operatorData.data) {
          setReceiverAccountId(operatorData.data);
          console.log('Operator ID obtido: ', operatorData.data);
        } else {
          console.error('Falha ao obter Operator ID');
        }
      } catch (error) {
        console.error('Erro ao buscar Operator ID:', error);
      }
    };
    
    fetchOperatorId();
  }, []);

  useEffect(() => {
    // Carregar mensagens se houver um topicId
    if (topicId) {
      loadMessagesFromTopic(topicId as string);
      // Também carregar informações de cota de mensagens
      fetchMessageAllowance(topicId as string);
    }
  }, [topicId]);

  // Função para buscar informações de cota de mensagens
  const fetchMessageAllowance = async (id: string) => {
    try {
      // Usar o endpoint do Next.js que faz proxy para o backend
      const response = await fetch(`/api/message-allowance?topicId=${id}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch message allowance: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setMessageAllowance({
          remainingMessages: data.remainingMessages,
          totalAllowance: data.totalAllowance,
          messagesUsed: data.messagesUsed
        });
        
        console.log(`Message allowance: ${data.remainingMessages}/${data.totalAllowance}`);
      } else {
        console.error('Error fetching message allowance:', data.error);
      }
    } catch (error) {
      console.error('Error fetching message allowance:', error);
    }
  };

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

  const loadMessagesFromTopic = async (id: string) => {
    try {
      setIsLoadingHistory(true);
      console.log(`Carregando mensagens do tópico: ${id}`);
      
      // Fetch messages from the API
      const response = await fetch(`/api/chat-messages?topicId=${id}`);
      
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
        
        // Convert each topic message to two chat messages (user and assistant)
        sortedMessages.forEach((msg: TopicMessage, index: number) => {
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
        
        console.log(`Loaded ${chatMessages.length} messages from topic ${id}`);
      } else {
        // If no messages were found, add a welcome message
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: `Bem-vindo ao chat do projeto com topicId: ${id}. Como posso ajudar você hoje?`,
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
          content: `Bem-vindo ao chat. Houve um erro ao carregar o histórico, mas podemos continuar a conversa.`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const saveMessageToTopic = async (message: Message) => {
    if (!topicId) return;
    
    try {
      // This is handled by the backend now via the askAssistant function
      // We just need to log for debugging
      console.log(`Message to topic ${topicId}:`, message);
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
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
    
    // Verificar se ainda há mensagens disponíveis
    if (messageAllowance && messageAllowance.remainingMessages <= 0) {
      // Adicionar mensagem de erro ao chat
      setMessages(prevMessages => [
        ...prevMessages,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Você atingiu o limite de mensagens disponíveis para este projeto. Por favor, adquira mais mensagens para continuar.',
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
    
    console.log("🔄 User message:", input);
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Save user message
      await saveMessageToTopic(userMessage);
      
      // Get response from AI
      console.log("🔄 Calling onSendMessage with input:", input);
      const response = await onSendMessage(input);
      console.log("🔄 Received response from AI:", response);
      console.log("🔄 Response type:", typeof response);
      console.log("🔄 Response length:", response?.length);
      
      // Verify response
      if (!response) {
        console.error("🔴 Empty response received from AI");
      }
      
      // Create assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };
      
      setMessages(prevMessages => [...prevMessages, assistantMessage]);
      
      // Save assistant message
      await saveMessageToTopic(assistantMessage);
      
      // Process new message for useful content
      console.log("🔄 Processing assistant response for useful content");
      processNewMessage(response);
      
      // Atualizar contagem de mensagens após envio bem-sucedido
      if (messageAllowance) {
        setMessageAllowance({
          ...messageAllowance,
          remainingMessages: Math.max(0, messageAllowance.remainingMessages - 1),
          messagesUsed: messageAllowance.messagesUsed + 1
        });
      }
      
      // Após enviar uma mensagem com sucesso, atualizar as informações de cota
      if (topicId) {
        // Adicionar um pequeno atraso antes de buscar a cota atualizada
        // para garantir que a atualização local seja exibida primeiro
        setTimeout(() => {
          fetchMessageAllowance(topicId as string);
        }, 1000);
      }
      
    } catch (error) {
      console.error('🔴 Error getting response:', error);
      
      // Add error message
      setMessages(prevMessages => [
        ...prevMessages,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Desculpe, ocorreu um erro ao processar sua solicitação.',
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

  // Função para processar o pagamento e adicionar mensagens
  const handlePaymentConfirm = async (transactionId: string, messageCount: number) => {
    if (!topicId) {
      alert('Não foi possível identificar o projeto');
      setShowPaymentModal(false);
      return;
    }
    
    try {
      // Fechar o modal de pagamento
      setShowPaymentModal(false);
      
      // Chamar a API Next.js que irá encaminhar para o backend
      const response = await fetch('/api/add-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topicId: topicId as string,
          messageCount: messageCount,
          paymentTransactionId: transactionId
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Compra realizada com sucesso! Você agora tem um total de ${data.newTotal} mensagens disponíveis.`);
        
        // Atualizar o estado local
        if (messageAllowance) {
          setMessageAllowance({
            ...messageAllowance,
            remainingMessages: messageAllowance.remainingMessages + messageCount,
            totalAllowance: data.newTotal || (messageAllowance.totalAllowance + messageCount)
          });
        }
        
        // Recarregar os dados do servidor para garantir que estão atualizados
        await fetchMessageAllowance(topicId as string);
      } else {
        alert(`Erro ao adicionar mensagens: ${data.error}`);
      }
    } catch (error: any) {
      console.error('Error purchasing messages:', error);
      alert(`Erro ao processar a compra: ${error.message || 'Erro desconhecido'}`);
    }
  };

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
            <p className="mt-3 text-center">Carregando histórico de mensagens...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/60 pt-16">
            <svg className="w-12 h-12 mb-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="text-center max-w-sm">
              Envie uma mensagem para iniciar uma conversa com nossa IA.
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
      
      {/* Adicionar indicador de mensagens restantes e botão para comprar mais */}
      {messageAllowance && (
        <div className={`px-4 py-2 flex items-center justify-between ${
          messageAllowance.remainingMessages <= 3 ? 'text-red-400' : 'text-gray-400'
        }`}>
          <div className="text-xs">
            {messageAllowance.remainingMessages > 0 ? (
              `Mensagens restantes: ${messageAllowance.remainingMessages} de ${messageAllowance.totalAllowance}`
            ) : (
              <span className="text-red-400 font-bold">
                Limite de mensagens atingido
              </span>
            )}
          </div>
          
          <button 
            onClick={() => setShowPaymentModal(true)}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded px-2 py-1 transition-colors"
          >
            Comprar mais mensagens
          </button>
        </div>
      )}
      
      <div className="px-4 py-2 border-t border-white/10">
        <div className="flex items-end space-x-2">
          <textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={messageAllowance && messageAllowance.remainingMessages <= 0 
              ? "Limite de mensagens atingido" 
              : "Digite sua mensagem..."}
            className="flex-1 bg-white/10 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none min-h-[50px] max-h-[100px]"
            rows={2}
            disabled={isLoading || !!(messageAllowance && messageAllowance.remainingMessages <= 0)}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || input.trim() === '' || !!(messageAllowance && messageAllowance.remainingMessages <= 0)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 h-10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Modal de pagamento */}
      {receiverAccountId && (
        <MessagePaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={handlePaymentConfirm}
          tokenId={tokenId}
          receiverAccountId={receiverAccountId}
        />
      )}
    </div>
  );
};

export default Chat; 