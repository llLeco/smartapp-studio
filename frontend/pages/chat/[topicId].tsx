import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '../../hooks/useWallet';
import Head from 'next/head';
import Chat from '../../components/Chat';
import Sidebar from '../../components/Sidebar';
import WalletConnectButton from '../../components/WalletConnectButton';
import WalletBalance from '../../components/WalletBalance';
import ActiveSessions from '../../components/ActiveSessions';
import BottomNavBar from '../../components/BottomNavBar';
import PageBackground from '../../components/PageBackground';
import styles from '../../styles/Home.module.css';
import { askAssistant } from '../../utils/apiHelpers';

// Componente para criar estrelas no fundo
const Stars = () => {
  const stars = Array.from({ length: 70 }).map((_, i) => {
    const size = Math.random() * 3 + 1;
    const animationDuration = Math.random() * 3 + 2;
    const animationDelay = Math.random() * 5;
    
    return (
      <div 
        key={i}
        className={styles.star}
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
  
  return <div className={styles.starContainer}>{stars}</div>;
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
        className={styles.orbit}
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

// PinnedItem interface matching the one in Chat.tsx
interface PinnedItem {
  id: string;
  type: 'code' | 'link';
  content: string;
  language?: string;
  title: string;
  url?: string;
  autoDetected?: boolean;
}

export default function ProjectChatPage() {
  const router = useRouter();
  const { topicId } = router.query;
  const [generatedStructure, setGeneratedStructure] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { isConnected, accountId } = useWallet();
  const [projectName, setProjectName] = useState("Meu Projeto");
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);

  // Efeito para garantir que o componente é montado apenas no cliente
  useEffect(() => {
    setMounted(true);
    
    // Se não estiver conectado, redirecionar para a página de login
    if (mounted && !isConnected) {
      router.push('/get-access');
    }
    
    // Carregar informações do projeto
    if (topicId && mounted) {
      loadProjectInfo(topicId as string);
    }
  }, [mounted, isConnected, topicId, router]);

  // Função para carregar informações do projeto
  const loadProjectInfo = async (id: string) => {
    try {
      console.log(`Carregando informações do projeto com topicId: ${id}`);
      // Aqui você poderia fazer uma chamada à API para buscar detalhes do projeto
      // Por enquanto, estamos apenas usando um nome padrão
      setProjectName(`Projeto #${id.slice(0, 8)}`);
    } catch (error) {
      console.error('Erro ao carregar informações do projeto:', error);
    }
  };

  // Function to handle sending messages to the AI
  const handleSendMessage = async (message: string, usageQuota: number) => {
    if (!topicId) {
      throw new Error('No topicId provided');
    }
    
    try {
      // Use the askAssistant function to send the message to the AI
      const response = await askAssistant(message, topicId as string, usageQuota);
      return response;
    } catch (error) {
      console.error('Error sending message to AI:', error);
      throw error;
    }
  };

  // Se não estiver montado ou conectado, não renderizar nada
  if (!mounted || !isConnected || !topicId) {
    return null;
  }

  return (
    <>
      <Head>
        <title>{projectName} | SmartApp Studio</title>
        <meta name="description" content="SmartApp Studio - Desenvolvendo no projeto" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="fixed inset-0 overflow-hidden">
        <PageBackground />
        <Stars />
        <OrbitingParticles />

        <div className="h-full w-full max-w-7xl mx-auto px-4 flex flex-col relative z-10 pb-16">
          {/* Main Container com efeito de janela macOS */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/30 backdrop-blur-md shadow-2xl my-6">
            {/* Barra superior estilo macOS */}
            <div className="bg-black/40 px-4 py-3 flex items-center border-b border-white/10 sticky top-0 z-10">
              <div className="flex space-x-2 mr-4">
                <div onClick={() => router.push('/app')} className="w-3 h-3 bg-red-500 rounded-full cursor-pointer hover:opacity-80 transition-opacity"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <button 
                  onClick={() => router.push('/app')}
                  className="mr-2 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <span className="text-sm font-medium text-white">{projectName}</span>
              </div>
              <div className="text-xs text-white/50 font-mono">
                {topicId}
              </div>
            </div>

            {/* Conteúdo principal com layout de duas colunas */}
            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar - visível apenas em telas maiores */}
              <div className="hidden md:block w-72 border-r border-white/10 bg-black/20">
                <Sidebar generatedStructure={generatedStructure} pinnedItems={pinnedItems} />
              </div>

              {/* Área de chat */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <Chat 
                  onSendMessage={handleSendMessage}
                  generatedStructure={generatedStructure}
                  setPinnedItems={setPinnedItems}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Barra de navegação inferior */}
        <BottomNavBar />
      </main>
    </>
  );
} 