import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatProps {
  onSendMessage: (message: string) => Promise<string>;
  generatedStructure: string | null;
}

const Chat: React.FC<ChatProps> = ({ onSendMessage, generatedStructure }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { topicId } = router.query;

  useEffect(() => {
    // Carregar mensagens se houver um topicId
    if (topicId) {
      loadMessagesFromTopic(topicId as string);
    }
  }, [topicId]);

  const loadMessagesFromTopic = async (id: string) => {
    try {
      // Aqui você poderia implementar a lógica para carregar mensagens
      // do topicId específico usando um endpoint do backend
      console.log(`Carregando mensagens do tópico: ${id}`);
      
      // Por enquanto, simulamos uma mensagem de boas-vindas para o tópico
      if (messages.length === 0) {
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
    }
  };

  const saveMessageToTopic = async (message: Message) => {
    if (!topicId) return;
    
    try {
      // Aqui você implementaria a lógica para salvar a mensagem no tópico
      // usando um endpoint do backend
      console.log(`Salvando mensagem no tópico ${topicId}:`, message);
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
    }
  };

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (input.trim() === '') return;
    
    // Create a new user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Save user message
      await saveMessageToTopic(userMessage);
      
      // Get response from AI
      const response = await onSendMessage(input);
      
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
    } catch (error) {
      console.error('Error getting response:', error);
      
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-custom">
        {messages.length === 0 ? (
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
                  <div className="prose prose-sm dark:prose-invert break-words">
                    {message.content}
                  </div>
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
        <div className="flex items-end space-x-2">
          <textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-white/10 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none min-h-[50px] max-h-[100px]"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || input.trim() === ''}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 h-10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat; 