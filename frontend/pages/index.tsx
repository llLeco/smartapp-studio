import { useState, useEffect } from 'react';
import Chat from '../components/Chat';
import Sidebar from '../components/Sidebar';
import WalletConnectButton from '../components/WalletConnectButton';
import WalletBalance from '../components/WalletBalance';
import ActiveSessions from '../components/ActiveSessions';

// Componente para criar estrelas no fundo
const Stars = () => {
  const stars = Array.from({ length: 70 }).map((_, i) => {
    const size = Math.random() * 3 + 1;
    const animationDuration = Math.random() * 3 + 2;
    const animationDelay = Math.random() * 5;
    
    return (
      <div 
        key={i}
        className="star"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          opacity: Math.random() * 0.7 + 0.3,
          animationDuration: `${animationDuration}s`,
          animationDelay: `${animationDelay}s`
        }}
      />
    );
  });
  
  return <div className="fixed inset-0 z-0 overflow-hidden">{stars}</div>;
};

// Componente para criar partículas orbitando
const OrbitingParticles = () => {
  const particles = Array.from({ length: 6 }).map((_, i) => {
    const size = Math.random() * 6 + 4;
    const distance = Math.random() * 10 + 10;
    const duration = Math.random() * 20 + 25;
    const delay = Math.random() * -20;
    const color = `rgba(${Math.floor(Math.random() * 100) + 100}, 0, ${Math.floor(Math.random() * 155) + 100}, 0.4)`;
    
    return (
      <div 
        key={i}
        className="absolute rounded-full orbit"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          background: color,
          boxShadow: `0 0 ${size * 2}px ${size / 2}px ${color}`,
          left: `calc(50% - ${size/2}px)`,
          top: `calc(50% - ${size/2}px)`,
          transformOrigin: `${distance}px ${distance}px`,
          animationDuration: `${duration}s`,
          animationDelay: `${delay}s`
        }}
      />
    );
  });
  
  return <div className="fixed inset-0 z-0 overflow-hidden">{particles}</div>;
};

export default function Home() {
  const [generatedStructure, setGeneratedStructure] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Esperar pelo client-side rendering para evitar problemas de hidratação
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSendMessage = async (message: string): Promise<string> => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: message }),
      });

      if (!response.ok) {
        throw new Error('Falha na requisição');
      }

      const data = await response.json();
      
      // Atualiza a estrutura gerada
      setGeneratedStructure(data.data);
      
      return data.data;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      throw error;
    }
  };
  
  // Função para resetar o chat e a estrutura
  const handleResetChat = () => {
    setGeneratedStructure(null);
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-screen items-center justify-center p-8 relative">
      {/* Background elements */}
      <Stars />
      <OrbitingParticles />
      
      {/* Floating window container */}
      <div className="w-[90%] max-w-7xl h-[85vh] rounded-xl glass-morphism animate-fade-in flex flex-col overflow-hidden relative z-10">
        {/* Window header - browser-like */}
        <div className="glass-header p-3 flex items-center justify-between">
          <div className="flex items-center space-x-2 pl-2">
            {/* Window controls (decorative) */}
            <div className="w-3 h-3 rounded-full bg-red-400 opacity-70"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-400 opacity-70"></div>
            <div className="w-3 h-3 rounded-full bg-green-400 opacity-70"></div>
          </div>
          
          {/* Window title */}
          <div className="flex items-center justify-center absolute left-1/2 transform -translate-x-1/2">
            <img
              src="/logo.svg"
              alt="SmartApp Studio Logo"
              width={24}
              height={24}
              className="mr-2"
            />
            <h1 className="text-white/90 font-medium">SmartApp Studio</h1>
          </div>
          
          <div className="w-auto flex justify-end items-center">
            <WalletBalance />
            <WalletConnectButton />
            <ActiveSessions />
          </div>
        </div>
        
        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chat panel */}
          <div className="w-3/5 border-r border-white/10 flex flex-col overflow-hidden">
            <Chat 
              onSendMessage={handleSendMessage} 
              onResetChat={handleResetChat}
              generatedStructure={generatedStructure}
            />
          </div>
          
          {/* Structure panel */}
          <div className="w-2/5 flex flex-col overflow-hidden">
            <Sidebar generatedStructure={generatedStructure} />
          </div>
        </div>
      </div>
      
      {/* Light effects */}
      <div className="fixed top-1/4 -left-20 w-60 h-60 bg-purple-600/20 rounded-full filter blur-[80px] z-0"></div>
      <div className="fixed bottom-1/3 -right-20 w-80 h-80 bg-indigo-600/20 rounded-full filter blur-[100px] z-0"></div>
    </div>
  );
} 