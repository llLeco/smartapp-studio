import { useState } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatProps {
  onSendMessage: (message: string) => Promise<string>;
  onResetChat?: () => void;
  generatedStructure?: string | null;
}

export default function Chat({ onSendMessage, onResetChat, generatedStructure }: ChatProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim()) return;
    
    // Add user message
    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    
    // Clear input
    setInput('');
    
    // Set loading state
    setIsLoading(true);
    
    try {
      // Send message to API
      const response = await onSendMessage(input);
      
      // Add assistant message
      const assistantMessage: ChatMessage = { role: 'assistant', content: response };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      // Show error message
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: 'Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to reset chat
  const resetChat = () => {
    if (window.confirm("Tem certeza que deseja iniciar um novo chat?")) {
      setMessages([]);
      
      // If parent provided a reset function, call it too
      if (onResetChat) {
        onResetChat();
      }
    }
  };

  // Function to save chat to file
  const saveChatToFile = () => {
    const data = {
      messages: [...messages],
      structure: generatedStructure,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'smartapp-chat.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL
    URL.revokeObjectURL(url);
    
    // TODO: Futuramente o conteúdo será enviado para um tópico na Hedera (via HCS)
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <div className="flex items-center">
          <div className="w-5 h-5 rounded-full bg-purple-500/30 flex items-center justify-center mr-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 12H16M8 16H16M10 3H14M6 7H18C19.1046 7 20 7.89543 20 9V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V9C4 7.89543 4.89543 7 6 7Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="text-sm font-medium text-white/70">Chat</h2>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={resetChat}
            className="flex items-center px-3 py-1.5 text-xs font-medium rounded-lg glass-button"
            title="Iniciar um novo chat"
          >
            <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 2V6C15 7.10457 14.1046 8 13 8H8M9 16V22M9 22L5 18M9 22L13 18M19 14V17M19 17V20M19 17H16M19 17H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            🧹 Novo Chat
          </button>
          
          <button
            onClick={saveChatToFile}
            className="flex items-center px-3 py-1.5 text-xs font-medium rounded-lg glass-button"
            title="Salvar conversa como arquivo JSON"
            disabled={messages.length === 0}
          >
            <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 7H5C3.89543 7 3 7.89543 3 9V18C3 19.1046 3.89543 20 5 20H19C20.1046 20 21 19.1046 21 18V9C21 7.89543 20.1046 7 19 7H16M15 11L12 14M12 14L9 11M12 14V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            💾 Salvar Chat
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center text-white/70">
            <div className="max-w-md">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 glass flex items-center justify-center border border-white/10">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 9H9.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M15 9H15.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="text-xl font-medium mb-3 tracking-wide">Descreva seu SmartApp</h3>
              <p className="opacity-60 leading-relaxed text-sm">
                Envie uma mensagem descrevendo o aplicativo que deseja criar com a tecnologia HbarSuite e SmartNodes.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div 
              key={index}
              className={`animate-fade-in ${
                msg.role === 'user' ? 'ml-6' : 'mr-6'
              }`}
            >
              <div className="flex items-start">
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-purple-700/40 flex items-center justify-center flex-shrink-0 mr-3 border border-white/5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                      <path d="M9 9h.01M15 9h.01"></path>
                    </svg>
                  </div>
                )}
                
                <div 
                  className={`p-4 rounded-lg ${
                    msg.role === 'user' 
                      ? 'ml-auto bg-white/5 border-t border-r border-white/10' 
                      : 'bg-white/5 border-t border-l border-white/10'
                  }`}
                >
                  <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                </div>
                
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center flex-shrink-0 ml-3 border border-white/5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="animate-fade-in mr-6">
            <div className="flex items-start">
              <div className="w-8 h-8 rounded-full bg-purple-700/40 flex items-center justify-center flex-shrink-0 mr-3 border border-white/5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                  <path d="M9 9h.01M15 9h.01"></path>
                </svg>
              </div>
              
              <div className="p-4 rounded-lg bg-white/5 border-t border-l border-white/10">
                <div className="flex items-center">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
                    <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse delay-150"></div>
                    <div className="w-2 h-2 rounded-full bg-purple-600 animate-pulse delay-300"></div>
                  </div>
                  <span className="text-white/50 text-xs ml-3">processando...</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-white/5 border border-white/10 backdrop-blur-xl rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-white/10 border border-white/10 hover:bg-purple-500/50 transition-all duration-300 text-white rounded-lg px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
} 