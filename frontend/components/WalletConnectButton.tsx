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
          ? 'Conectando...'
          : isConnected
          ? `Conta: ${accountId?.slice(0, 6)}...${accountId?.slice(-4)}`
          : 'Conectar Carteira'}
      </button>
      
      <ConfirmationDialog
        isOpen={showDisconnectConfirm}
        onClose={() => setShowDisconnectConfirm(false)}
        onConfirm={handleDisconnect}
        title="Desconectar carteira"
        message="Tem certeza que deseja desconectar sua carteira? Esta ação encerrará sua sessão atual."
        confirmButtonText="Desconectar"
      />
    </>
  );
};

export default WalletConnectButton;
