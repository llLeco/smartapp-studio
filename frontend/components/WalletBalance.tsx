// frontend/components/WalletBalance.tsx
import { useEffect, useState, useRef } from 'react';
import { useWallet } from '../hooks/useWallet';

interface AccountInfo {
  hbarBalance: string;
  hsuiteBalance: string;
  network: string;
  lastUpdated: Date;
}

const WalletBalance = () => {
  const { isConnected, connector } = useWallet();
  const [accountInfo, setAccountInfo] = useState<AccountInfo>({
    hbarBalance: '0',
    hsuiteBalance: '0',
    network: 'Testnet',
    lastUpdated: new Date()
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isConnected || !connector) return;

    const fetchBalance = async () => {
      try {
        const accountId = connector.signers[0].accountId.toString();
        
        // Fetch HBAR balance
        const mirrorUrl = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}`;
        const hbarRes = await fetch(mirrorUrl);
        const hbarData = await hbarRes.json();
        const tinybars = hbarData.balance?.balance || 0;
        const hbarBalance = (tinybars / 1e8).toFixed(6);
        
        // Fetch HSuite balance
        const hsuiteTokenId = process.env.NEXT_PUBLIC_HSUITE_TOKEN_ID;
        const tokenUrl = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens?token.id=${hsuiteTokenId}`;
        const tokenRes = await fetch(tokenUrl);
        const tokenData = await tokenRes.json();
        
        let hsuiteBalance = '0';
        if (tokenData.tokens && tokenData.tokens.length > 0) {
          const rawBalance = tokenData.tokens[0].balance;
          hsuiteBalance = (parseInt(rawBalance) / 1e8).toFixed(6);
        }
        
        setAccountInfo({
          hbarBalance,
          hsuiteBalance,
          network: 'Testnet',
          lastUpdated: new Date()
        });
      } catch (err) {
        console.warn('Error fetching balances:', err);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [isConnected, connector]);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  if (!isConnected) return null;

  const formattedTime = accountInfo.lastUpdated.toLocaleTimeString();

  return (
    <div className="relative mr-2" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="px-3 py-1.5 rounded-lg glass-button text-xs font-medium flex items-center"
      >
        <span className="mr-1">Balance</span>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className={`h-3 w-3 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isDropdownOpen && (
        <div className="absolute right-0 mt-1 w-64 rounded-lg p-3 z-50 shadow-xl" 
          style={{
            backgroundColor: 'rgba(26, 16, 58, 0.95)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(128, 90, 213, 0.2)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
          }}>
          <div className="text-xs space-y-3">
            <div className="flex justify-between items-center pt-1 border-b border-white/10 pb-2">
              <span className="opacity-70">Network:</span>
              <span className="font-medium">{accountInfo.network}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="opacity-70">HBAR:</span>
              <span className="font-bold">{accountInfo.hbarBalance} ℏ</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="opacity-70">HSuite:</span>
              <span className="font-bold">{accountInfo.hsuiteBalance}</span>
            </div>
            
            <div className="flex justify-between items-center text-[10px] border-t border-white/10 pt-2 mt-2">
              <span className="opacity-50">Updated:</span>
              <span className="opacity-70">{formattedTime}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletBalance;
