// frontend/hooks/useWallet.ts
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { DAppConnector } from '@hashgraph/hedera-wallet-connect';
import { Transaction } from '@hashgraph/sdk';
import getDAppConnector, { resetDAppConnector } from '../lib/walletConnect';

interface WalletContextType {
  accountId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connector: DAppConnector | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  disconnectSession: (topic: string) => Promise<boolean>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  activeSessions: Array<{
    topic: string;
    accountId: string;
    network: string;
  }>;
}

const WalletContext = createContext<WalletContextType>({
  accountId: null,
  isConnected: false,
  isConnecting: false,
  connector: null,
  connect: async () => {},
  disconnect: async () => {},
  disconnectSession: async () => false,
  signTransaction: async () => { throw new Error('Not implemented'); },
  activeSessions: []
});

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connector, setConnector] = useState<DAppConnector | null>(null);
  const [activeSessions, setActiveSessions] = useState<Array<{
    topic: string;
    accountId: string;
    network: string;
  }>>([]);

  // Function to update active sessions
  const updateActiveSessions = (instance: DAppConnector | null) => {
    if (!instance || instance.signers.length === 0) {
      setActiveSessions([]);
      return;
    }

    const sessions = instance.signers.map(signer => ({
      topic: signer.topic || 'unknown',
      accountId: signer.accountId.toString(),
      network: 'Testnet'
    }));

    setActiveSessions(sessions);
  };

  useEffect(() => {
    const reconnect = async () => {
      try {
        const instance = await getDAppConnector();
        if (instance.signers.length > 0) {
          const id = instance.signers[0].accountId.toString();
          setAccountId(id);
          setIsConnected(true);
          setConnector(instance);
          updateActiveSessions(instance);
        }
      } catch (err) {
        console.warn('Erro ao reconectar:', err);
      }
    };

    reconnect();
  }, []);

  const connect = async () => {
    setIsConnecting(true);
    try {
      const instance = await getDAppConnector(true);
      await instance.openModal();
      if (instance.signers.length > 0) {
        const id = instance.signers[0].accountId.toString();
        setAccountId(id);
        setIsConnected(true);
        setConnector(instance);
        updateActiveSessions(instance);
      }
    } catch (err) {
      console.error('Erro ao conectar:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const signTransaction = async (transaction: Transaction): Promise<Transaction> => {
    if (!connector || connector.signers.length === 0) {
      throw new Error('Wallet not connected');
    }

    try {
      // Get the first signer
      const signer = connector.signers[0];
      
      // Use the signer to sign the transaction
      if (typeof signer.signTransaction === 'function') {
        const signedTx = await signer.signTransaction(transaction);
        return signedTx;
      } else {
        throw new Error('Wallet does not support transaction signing');
      }
    } catch (err: any) {
      console.error('Error signing transaction:', err);
      throw new Error(err.message || 'Failed to sign transaction');
    }
  };

  const disconnectSession = async (topic: string): Promise<boolean> => {
    if (!connector) return false;

    try {
      const signer = connector.signers.find(s => s.topic === topic);
      if (signer && signer.signClient && topic) {
        await signer.signClient.disconnect({
          topic,
          reason: { code: 6000, message: 'User disconnected' }
        });
        
        // Update sessions and connector
        const updatedInstance = await getDAppConnector();
        updateActiveSessions(updatedInstance);
        
        // If no sessions left, fully disconnect
        if (updatedInstance.signers.length === 0) {
          resetDAppConnector();
          setAccountId(null);
          setIsConnected(false);
          setConnector(null);
        } else {
          // Update primary accountId if needed
          if (accountId === signer.accountId.toString()) {
            setAccountId(updatedInstance.signers[0].accountId.toString());
          }
          setConnector(updatedInstance);
        }
        
        return true;
      }
    } catch (err) {
      console.warn(`Erro ao desconectar sessão: ${err}`);
    }
    
    return false;
  };

  const disconnect = async () => {
    try {
      console.log('Disconnecting...', connector);
      if (connector && connector.signers.length > 0) {
        // Disconnect each signer individually by their topic
        for (const signer of connector.signers) {
          try {
            if (signer.topic && signer.signClient) {
              await signer.signClient.disconnect({
                topic: signer.topic,
                reason: { code: 6000, message: 'User disconnected' }
              });
            }
          } catch (signerErr) {
            console.warn(`Erro ao desconectar signer: ${signerErr}`);
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao desconectar:', err);
    } finally {
      resetDAppConnector();
      setAccountId(null);
      setIsConnected(false);
      setConnector(null);
      setActiveSessions([]);
    }
  };

  return (
    <WalletContext.Provider value={{ 
      accountId, 
      isConnected, 
      isConnecting, 
      connector, 
      connect, 
      disconnect,
      disconnectSession,
      signTransaction,
      activeSessions
    }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);
