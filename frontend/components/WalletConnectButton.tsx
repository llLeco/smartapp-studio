import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import ConfirmationDialog from './ConfirmationDialog';

const WalletConnectButton = () => {
  const { accountId, isConnected, isConnecting, connect, disconnect } = useWallet();
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const handleClick = () => {
    if (isConnected) {
      setShowDisconnectConfirm(true);
    } else {
      connect();
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  if (typeof window === 'undefined') return null;

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isConnecting}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium glass-button ${isConnecting ? 'opacity-50' : ''}`}
      >
        {isConnecting
          ? 'Connecting...'
          : isConnected
          ? `Account: ${accountId?.slice(0, 6)}...${accountId?.slice(-4)}`
          : 'Connect Wallet'}
      </button>
      
      <ConfirmationDialog
        isOpen={showDisconnectConfirm}
        onClose={() => setShowDisconnectConfirm(false)}
        onConfirm={handleDisconnect}
        title="Disconnect wallet"
        message="Are you sure you want to disconnect your wallet? This action will end your current session."
        confirmButtonText="Disconnect"
      />
    </>
  );
};

export default WalletConnectButton;
