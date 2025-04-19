// frontend/components/WalletBalance.tsx
import { useEffect, useState } from 'react';
import { useWallet } from '../hooks/useWallet';

interface AccountInfo {
  balance: string;
  network: string;
  lastUpdated: Date;
}

const WalletBalance = () => {
  const { isConnected, connector } = useWallet();
  const [accountInfo, setAccountInfo] = useState<AccountInfo>({
    balance: '0',
    network: 'Testnet',
    lastUpdated: new Date()
  });

  useEffect(() => {
    if (!isConnected || !connector) return;

    const fetchBalance = async () => {
      try {
        const accountId = connector.signers[0].accountId.toString();
        const mirrorUrl = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}`;
        const res = await fetch(mirrorUrl);
        const data = await res.json();
        const tinybars = data.balance?.balance || 0;
        
        setAccountInfo({
          balance: (tinybars / 1e8).toFixed(6),
          network: 'Testnet',
          lastUpdated: new Date()
        });
      } catch (err) {
        console.warn('Erro ao buscar saldo HBAR:', err);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [isConnected, connector]);

  if (!isConnected) return null;

  return (
    <div className="ml-2 px-3 py-1.5 rounded-lg glass-button text-xs font-medium flex items-center">
      <span className="mr-1">Saldo:</span>
      <span className="font-bold">{accountInfo.balance} ℏ</span>
    </div>
  );
};

export default WalletBalance;
