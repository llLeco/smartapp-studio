import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '../../hooks/useWallet';
import Head from 'next/head';
import Chat from '../../components/Chat';
import Sidebar from '../../components/Sidebar';
import BottomNavBar from '../../components/BottomNavBar';
import PageBackground from '../../components/PageBackground';
import styles from '../../styles/Home.module.css';

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

const HCS10Badge = () => (
  <div className="flex items-center bg-indigo-800/40 px-2 py-1 rounded-md text-xs font-mono">
    <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 mr-1.5 animate-pulse"></span>
    <span className="text-indigo-300">HCS-10</span>
  </div>
);

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
  const [projectName, setProjectName] = useState("My Project");
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);
  const [isHcs10Compatible, setIsHcs10Compatible] = useState(true);

  // Effect to ensure the component is mounted only on the client
  useEffect(() => {
    setMounted(true);
    
    // If not connected, redirect to the login page
    if (mounted && !isConnected) {
      router.push('/get-access');
    }
    
    // Load project information
    if (topicId && mounted) {
      loadProjectInfo(topicId as string);
    }
  }, [mounted, isConnected, topicId, router]);

  // Function to load project information
  const loadProjectInfo = async (id: string) => {
    try {
      console.log(`Loading project information with topicId: ${id}`);
      setProjectName(`Project #${id}`);
      setIsHcs10Compatible(true);
    } catch (error) {
      console.error('Error loading project information:', error);
    }
  };

  // If not mounted or connected, don't render anything
  if (!mounted || !isConnected || !topicId) {
    return null;
  }

  return (
    <>
      <Head>
        <title>{projectName} | SmartApp Studio</title>
        <meta name="description" content="SmartApp Studio - Developing in the project" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="fixed inset-0 overflow-hidden">
        <PageBackground />
        <Stars />
        <OrbitingParticles />

        <div className="h-full w-full max-w-7xl mx-auto px-4 flex flex-col relative z-10 pb-16">
          {/* Main Container with macOS window effect */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/30 backdrop-blur-md shadow-2xl my-6">
            {/* macOS style top bar */}
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
                
                {/* HCS-10 compatibility badge */}
                {isHcs10Compatible && (
                  <div className="ml-3">
                    <HCS10Badge />
                  </div>
                )}
              </div>
              <div className="flex items-center">
                <span className="text-xs text-white/50 font-mono">
                  {topicId}
                </span>
              </div>
            </div>

            {/* Main content with two-column layout */}
            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar - visible only on larger screens */}
              <div className="hidden md:block w-72 border-r border-white/10 bg-black/20">
                <Sidebar generatedStructure={generatedStructure} pinnedItems={pinnedItems} />
              </div>

              {/* Chat area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <Chat 
                  generatedStructure={generatedStructure}
                  setPinnedItems={setPinnedItems}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom navigation bar */}
        <BottomNavBar />
      </main>
    </>
  );
} 