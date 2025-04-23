import { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '../hooks/useWallet';
import BottomNavBar from './BottomNavBar';
import PageBackground from './PageBackground';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const router = useRouter();
  const { isConnected } = useWallet();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <PageBackground />
      
      {/* Main content */}
      <main className="relative z-10 pb-16">
        {children}
      </main>
      
      {/* Navigation */}
      <BottomNavBar />
    </div>
  );
};

export default AppLayout; 