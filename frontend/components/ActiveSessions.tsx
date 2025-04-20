import { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import ConfirmationDialog from './ConfirmationDialog';
import Portal from './Portal';

const ActiveSessions = () => {
  const { isConnected, activeSessions, disconnectSession } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [sessionToDisconnect, setSessionToDisconnect] = useState<string | null>(null);

  const handleOpenModal = () => {
    setIsOpen(true);
  };

  const handleCloseModal = () => {
    setIsOpen(false);
  };

  const handleDisconnectSession = (topic: string) => {
    setSessionToDisconnect(topic);
  };

  const confirmDisconnectSession = async () => {
    if (!sessionToDisconnect) return;
    await disconnectSession(sessionToDisconnect);
    setSessionToDisconnect(null);
  };

  if (!isConnected || typeof window === 'undefined') return null;

  return (
    <>
      <button 
        onClick={handleOpenModal} 
        className="ml-1 px-2 py-1.5 rounded-lg text-xs glass-button opacity-80 hover:opacity-100"
        title="Ver sessões ativas"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </button>

      {isOpen && (
        <Portal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div 
              className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm"
              onClick={handleCloseModal}
            />
            <div 
              className="bg-[#1a103a]/90 rounded-lg p-5 max-w-md w-full mx-4 shadow-2xl border border-purple-500/20 relative z-[10000]"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={handleCloseModal}
                className="absolute top-2 right-2 text-white/70 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              
              <h2 className="text-xl font-bold mb-4">Sessões Ativas</h2>
              
              {activeSessions.length === 0 ? (
                <p className="text-center py-4 text-white/70">Nenhuma sessão ativa encontrada</p>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {activeSessions.map((session) => (
                    <div key={session.topic} className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">Conta: {session.accountId}</p>
                          <p className="text-xs text-white/70">Rede: {session.network}</p>
                          <p className="text-xs text-white/50 truncate">Topic: {session.topic}</p>
                        </div>
                        <button 
                          onClick={() => handleDisconnectSession(session.topic)}
                          className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-300 hover:bg-red-500/30"
                        >
                          Desconectar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Portal>
      )}

      <ConfirmationDialog
        isOpen={!!sessionToDisconnect}
        onClose={() => setSessionToDisconnect(null)}
        onConfirm={confirmDisconnectSession}
        title="Desconectar sessão"
        message="Tem certeza que deseja desconectar esta sessão?"
        confirmButtonText="Desconectar"
      />
    </>
  );
};

export default ActiveSessions; 