import { useRouter } from 'next/router';
import { useWallet } from '../hooks/useWallet';
import { useState, useEffect } from 'react';

const BottomNavBar = () => {
  const router = useRouter();
  const { isConnected, accountId, connect } = useWallet();
  const [mounted, setMounted] = useState(false);

  // Garantir renderização client-side
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Formatar accountId para exibição
  const formatAccountId = (id: string | null) => {
    if (!id) return '';
    if (id.length <= 12) return id;
    return `${id.substring(0, 6)}...${id.substring(id.length - 4)}`;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center">
      <div className="mx-auto">
        <nav className="backdrop-blur-md bg-black/30 border-t border-white/10 shadow-lg mx-2 mb-2 rounded-full flex items-center justify-between px-4 py-2">
          {/* Home Button */}
          <button
            onClick={() => router.push('/')}
            className={`p-3 md:p-3 rounded-full transition-all duration-200 ${
              router.pathname === '/' 
                ? 'bg-indigo-600/30 text-indigo-300' 
                : 'hover:bg-white/10 text-white/70 hover:text-white'
            } mr-2`}
          >
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>

          {/* Projects Button */}
          <button
            onClick={() => router.push('/app')}
            className={`p-3 md:p-3 rounded-full transition-all duration-200 ${
              router.pathname === '/app' 
                ? 'bg-indigo-600/30 text-indigo-300' 
                : 'hover:bg-white/10 text-white/70 hover:text-white'
            } mr-2`}
          >
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </button>

          {/* Settings Button */}
          {/* <button
            onClick={() => {}}
            className="p-3 md:p-3 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-all duration-200 mr-2"
          >
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button> */}

          {/* Wallet Connect Button */}
          <button
            onClick={!isConnected ? connect : () => router.push('/get-access')}
            className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm transition-all duration-200 ${
              isConnected 
                ? 'bg-indigo-600/30 text-indigo-300' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {isConnected ? formatAccountId(accountId) : 'Connect Wallet'}
          </button>
        </nav>
      </div>
    </div>
  );
};

export default BottomNavBar; 