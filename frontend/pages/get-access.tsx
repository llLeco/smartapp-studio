import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '../hooks/useWallet';
import * as licenseService from '../services/licenseService';
import Head from 'next/head';
import PageBackground from '../components/PageBackground';

// Interfaces para tipagem
interface NftMetadata {
  name: string;
  description: string;
  topicId?: string;
  creator?: string;
  createdAt?: string;
  type: string;
}

interface LicenseInfo {
  tokenId: string;
  serialNumber: number;
  topicId: string;
  metadata: NftMetadata;
  ownerId: string;
}

interface AccessCardProps {
  licenseInfo: LicenseInfo | null;
  accountId: string | null;
  usageInfo: {
    totalUsage: number;
    usageLimit: number;
    remainingUsage: number;
  } | null;
  activeSessions: Array<{
    topic: string;
    accountId: string;
    network: string;
  }>;
  onDisconnect: (topic?: string) => void;
}

interface BuyLicenseButtonProps {
  onClick: () => Promise<void>;
  loading: boolean;
}

interface LicenseStatusProps {
  isValid: boolean;
  checking: boolean;
}

// TransactionStep component to show progress
interface TransactionStepProps {
  step: string;
  title: string;
  description: string;
  status: 'waiting' | 'current' | 'completed' | 'error';
  errorMessage?: string;
}

const TransactionStep: React.FC<TransactionStepProps> = ({ 
  step, 
  title, 
  description, 
  status,
  errorMessage
}) => {
  return (
    <div className="flex items-start mb-4">
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full mr-3">
        {status === 'waiting' && (
          <div className="w-8 h-8 rounded-full border-2 border-gray-500 flex items-center justify-center">
            <span className="text-sm text-gray-400">{step}</span>
          </div>
        )}
        {status === 'current' && (
          <div className="w-8 h-8 rounded-full bg-blue-900 border-2 border-blue-500 flex items-center justify-center">
            <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
        {status === 'completed' && (
          <div className="w-8 h-8 rounded-full bg-green-900 border-2 border-green-500 flex items-center justify-center">
            <svg className="h-4 w-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        )}
        {status === 'error' && (
          <div className="w-8 h-8 rounded-full bg-red-900 border-2 border-red-500 flex items-center justify-center">
            <svg className="h-4 w-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1">
        <h4 className={`font-medium ${
          status === 'completed' ? 'text-green-400' : 
          status === 'current' ? 'text-blue-400' :
          status === 'error' ? 'text-red-400' :
          'text-gray-300'
        }`}>
          {title}
        </h4>
        <p className="text-sm text-gray-300">{description}</p>
        {status === 'error' && errorMessage && (
          <p className="text-sm text-red-400 mt-1">{errorMessage}</p>
        )}
      </div>
    </div>
  );
};

// Componentes internos
const AccessCard: React.FC<AccessCardProps> = ({ licenseInfo, accountId, usageInfo, activeSessions, onDisconnect }) => {
  if (!licenseInfo) {
    return (
      <div className="p-6 backdrop-blur-lg bg-black/40 rounded-xl border border-gray-700 shadow-xl">
        <h3 className="text-xl font-medium text-white">Sem Licença Ativa</h3>
        <p className="mt-2 text-gray-300">
          Você ainda não possui uma licença para acessar o SmartApp Studio.
        </p>
        {accountId && (
          <div className="mt-3 mb-4 px-3 py-2 bg-gray-800 rounded">
            <p className="text-sm text-gray-300">Account ID: {accountId}</p>
          </div>
        )}
        
        {activeSessions.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-white mb-2">Sessões ativas:</h4>
            <div className="space-y-2">
              {activeSessions.map((session) => (
                <div key={session.topic} className="flex items-center justify-between px-3 py-2 bg-gray-800/50 rounded">
                  <div>
                    <p className="text-xs text-gray-300">{session.accountId}</p>
                    <p className="text-xs text-gray-500">{session.network}</p>
                  </div>
                  <button
                    onClick={() => onDisconnect(session.topic)}
                    className="text-xs px-2 py-1 bg-red-900/30 hover:bg-red-800/50 text-red-300 rounded transition-colors"
                  >
                    Desconectar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 backdrop-blur-lg bg-black/40 rounded-xl border border-gray-700 shadow-xl">
      <div className="flex justify-between items-start">
        <h3 className="text-xl font-medium text-white">Licença SmartApp</h3>
        <span className="px-2 py-1 bg-green-900 text-green-300 text-xs rounded-full">
          Ativa
        </span>
      </div>
      
      {/* Detalhes da licença */}
      <div className="mt-4 grid gap-3">
        <div className="flex justify-between">
          <span className="text-gray-400">ID do Token:</span>
          <span className="text-white font-mono">{licenseInfo.tokenId}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400">Nº de Série:</span>
          <span className="text-white font-mono">{licenseInfo.serialNumber}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400">Tipo:</span>
          <span className="text-white">{licenseInfo.metadata?.type || 'Padrão'}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400">Tópico:</span>
          <span className="text-white font-mono text-xs truncate max-w-[200px]">{licenseInfo.topicId}</span>
        </div>
      </div>
      
      {usageInfo && (
        <div className="mt-6">
          <div className="flex justify-between mb-1">
            <span className="text-sm text-gray-300">Uso de recursos</span>
            <span className="text-sm text-gray-300">
              {usageInfo.totalUsage} / {usageInfo.usageLimit}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-600" 
              style={{
                width: `${(usageInfo.totalUsage / usageInfo.usageLimit) * 100}%`
              }}
            ></div>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {usageInfo.remainingUsage} unidades restantes
          </p>
        </div>
      )}
      
      <div className="mt-6 pt-4 border-t border-gray-700">
        <p className="text-sm text-gray-400">
          {accountId ? `Conectado como: ${accountId}` : 'Não conectado'}
        </p>
      </div>
      
      {activeSessions.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-white mb-2">Sessões ativas:</h4>
          <div className="space-y-2">
            {activeSessions.map((session) => (
              <div key={session.topic} className="flex items-center justify-between px-3 py-2 bg-gray-800/50 rounded">
                <div>
                  <p className="text-xs text-gray-300">{session.accountId}</p>
                  <p className="text-xs text-gray-500">{session.network}</p>
                </div>
                <button
                  onClick={() => onDisconnect(session.topic)}
                  className="text-xs px-2 py-1 bg-red-900/30 hover:bg-red-800/50 text-red-300 rounded transition-colors"
                >
                  Desconectar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const BuyLicenseButton: React.FC<BuyLicenseButtonProps> = ({ onClick, loading }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-lg font-medium rounded-xl text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-lg transition-all duration-300 transform hover:-translate-y-1"
  >
    {loading ? (
      <span className="flex items-center">
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Processando...
      </span>
    ) : (
      <span>Adquirir Acesso</span>
    )}
  </button>
);

const LicenseStatus: React.FC<LicenseStatusProps> = ({ isValid, checking }) => {
  if (checking) {
    return (
      <div className="flex items-center space-x-2 text-gray-300">
        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Verificando licença...</span>
      </div>
    );
  }

  if (isValid) {
    return (
      <div className="flex items-center space-x-2 text-green-400">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>Licença válida</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 text-yellow-300">
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
      </svg>
      <span>Licença não encontrada</span>
    </div>
  );
};

// Interface para os tipos de uso
interface UsageInfo {
  totalUsage: number;
  usageLimit: number;
  remainingUsage: number;
}

const GetAccessPage = () => {
  const router = useRouter();
  const { accountId, isConnected, connect, disconnect, disconnectSession, activeSessions } = useWallet();
  const [loading, setLoading] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [error, setError] = useState<string>('');
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);
  const [topicToDisconnect, setTopicToDisconnect] = useState<string | undefined>(undefined);
  
  // State for multi-step license creation
  const [showSteps, setShowSteps] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<string>('init');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [stepStatus, setStepStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [stepError, setStepError] = useState<string | undefined>(undefined);
  const [licenseProcessData, setLicenseProcessData] = useState<{
    topicId?: string;
    tokenId?: string;
    serialNumber?: number;
  }>({});

  // Define steps
  const steps = [
    { 
      key: 'createTopic', 
      title: 'Criar Tópico', 
      description: 'Criando tópico para sua licença' 
    },
    { 
      key: 'mintToken', 
      title: 'Preparar Licença', 
      description: 'Configurando metadados da licença' 
    },
    { 
      key: 'associateToken', 
      title: 'Emitir Token', 
      description: 'Criando token de licença na blockchain' 
    },
    { 
      key: 'complete', 
      title: 'Finalizar', 
      description: 'Ativando a licença para uso' 
    }
  ];

  // Verificar se o usuário tem licença válida
  useEffect(() => {
    const checkLicense = async () => {
      if (isConnected && accountId) {
        try {
          setChecking(true);
          setError('');
          
          const result = await licenseService.checkLicenseValidity(accountId);
          
          if (result.isValid && result.licenseInfo) {
            setLicenseInfo(result.licenseInfo);
            
            // Obter informações de uso da licença (simulado)
            setUsageInfo({
              totalUsage: 0,
              usageLimit: 100,
              remainingUsage: 100
            });
          }
        } catch (err: any) {
          console.error('Erro ao verificar licença:', err);
          setError(err.message || 'Erro ao verificar licença');
        } finally {
          setChecking(false);
        }
      } else {
        setChecking(false);
      }
    };

    checkLicense();
  }, [isConnected, accountId]);

  // Handler para iniciar o processo de licença
  const handleStartLicenseProcess = async () => {
    if (!isConnected || !accountId) {
      try {
        await connect();
        return; // Wait for the connect to trigger a re-render
      } catch (err) {
        console.error('Erro ao conectar carteira:', err);
        return;
      }
    }
    
    setShowSteps(true);
    setCurrentStepIndex(0);
    setCurrentStep('createTopic');
    setStepStatus('pending');
    setStepError(undefined);
    setLicenseProcessData({});
    
    // Iniciar o processo
    await handleNextStep();
  };

  // Process next step in license creation
  const handleNextStep = async () => {
    if (!accountId) return;
    
    try {
      setLoading(true);
      setError('');
      setStepStatus('pending');
      setStepError(undefined);
      
      switch (currentStep) {
        case 'createTopic': {
          // Init and create topic in one step
          const metadata: NftMetadata = {
            name: 'SmartApp License',
            description: 'Licença de acesso ao SmartApp Studio',
            type: 'LICENSE'
          };
          
          const initState = await licenseService.initLicenseCreation(metadata);
          const topicState = await licenseService.createLicenseTopic(initState);
          
          if (topicState.error) {
            throw new Error(topicState.error);
          }
          
          setLicenseProcessData({
            topicId: topicState.topicId,
            tokenId: topicState.tokenId
          });
          
          setCurrentStep('mintToken');
          setCurrentStepIndex(1);
          setStepStatus('success');
          break;
        }
        
        case 'mintToken': {
          // Mint token
          const mintState = await licenseService.mintLicenseToken({
            step: 'mintToken',
            topicId: licenseProcessData.topicId,
            tokenId: licenseProcessData.tokenId,
            accountId
          });
          
          if (mintState.error) {
            throw new Error(mintState.error);
          }
          
          setLicenseProcessData(prev => ({
            ...prev,
            serialNumber: mintState.serialNumber
          }));
          
          setCurrentStep('associateToken');
          setCurrentStepIndex(2);
          setStepStatus('success');
          break;
        }
        
        case 'associateToken': {
          // Associate token
          const associateState = await licenseService.associateLicenseToken({
            step: 'associateToken',
            topicId: licenseProcessData.topicId,
            tokenId: licenseProcessData.tokenId,
            serialNumber: licenseProcessData.serialNumber,
            accountId
          });
          
          if (associateState.error) {
            throw new Error(associateState.error);
          }
          
          // Transfer token is part of this step now
          const transferState = await licenseService.transferLicenseWithSubscription({
            step: 'transferToken',
            topicId: licenseProcessData.topicId,
            tokenId: licenseProcessData.tokenId,
            serialNumber: licenseProcessData.serialNumber,
            accountId
          });
          
          if (transferState.error) {
            throw new Error(transferState.error);
          }
          
          setCurrentStep('complete');
          setCurrentStepIndex(3);
          setStepStatus('success');
          
          // Check license after all steps
          const result = await licenseService.checkLicenseValidity(accountId);
          if (result.isValid && result.licenseInfo) {
            setLicenseInfo(result.licenseInfo);
            setUsageInfo({
              totalUsage: 0,
              usageLimit: 100,
              remainingUsage: 100
            });
          }
          
          // Redirect to app after successful license creation
          setTimeout(() => {
            router.push('/app');
          }, 2000);
          break;
        }
      }
    } catch (err: any) {
      console.error('Erro no processo de licença:', err);
      setStepStatus('error');
      setStepError(err.message || 'Erro no processo de licença');
      setError(err.message || 'Erro no processo de licença');
    } finally {
      setLoading(false);
    }
  };

  // Retry current step if error
  const handleRetry = async () => {
    setStepStatus('pending');
    setStepError(undefined);
    await handleNextStep();
  };

  // Get status for a step
  const getStepStatus = (stepIndex: number): 'waiting' | 'current' | 'completed' | 'error' => {
    if (stepIndex < currentStepIndex) {
      return 'completed';
    } else if (stepIndex === currentStepIndex) {
      if (stepStatus === 'error') {
        return 'error';
      } else if (stepStatus === 'success') {
        return 'completed';
      } else {
        return 'current';
      }
    } else {
      return 'waiting';
    }
  };

  // Handler para desconectar a carteira
  const handleDisconnect = (topic?: string) => {
    setTopicToDisconnect(topic);
    setShowConfirmation(true);
  };
  
  // Confirmar desconexão
  const confirmDisconnect = async () => {
    try {
      if (topicToDisconnect) {
        await disconnectSession(topicToDisconnect);
      } else {
        await disconnect();
      }
      setShowConfirmation(false);
    } catch (err) {
      console.error('Erro ao desconectar:', err);
    }
  };

  return (
    <>
      <Head>
        <title>Obter Acesso | SmartApp Studio</title>
        <meta name="description" content="Obtenha acesso ao SmartApp Studio" />
      </Head>
      
      <div className="min-h-screen relative pb-16">
        <PageBackground />
        
        <div className="relative z-10 container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <img
                src="/logo.svg"
                alt="SmartApp Studio Logo" 
                className="h-16 w-auto mx-auto mb-4"
              />
              <h1 className="text-3xl font-bold text-white">Acesso ao SmartApp Studio</h1>
              <p className="text-gray-300 mt-2">
                Conecte sua carteira para verificar ou adquirir uma licença
              </p>
            </div>
            
            <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
              {/* Status da licença */}
              <div className="mb-6">
                {checking ? (
                  <div className="flex items-center space-x-2 text-gray-300">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Verificando licença...</span>
                  </div>
                ) : licenseInfo ? (
                  <div className="flex items-center space-x-2 text-green-400">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span>Licença válida</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-yellow-300">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                    <span>Licença não encontrada</span>
                  </div>
                )}
              </div>
              
              {error && (
                <div className="mb-6 p-4 bg-red-900/40 border border-red-500/50 rounded-lg">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}
              
              {!showSteps ? (
                <>
                  {/* Cartão de licença */}
                  <div className="mb-6">
                    <AccessCard 
                      licenseInfo={licenseInfo} 
                      accountId={accountId} 
                      usageInfo={usageInfo}
                      activeSessions={activeSessions}
                      onDisconnect={handleDisconnect}
                    />
                  </div>
                  
                  {/* Botões de ação */}
                  <div className="flex flex-col space-y-4">
                    {!isConnected ? (
                      <button
                        onClick={() => connect()}
                        className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-lg transition-colors"
                      >
                        Conectar Carteira
                      </button>
                    ) : !licenseInfo ? (
                      <>
                        <button
                          onClick={handleStartLicenseProcess}
                          disabled={loading}
                          className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loading ? (
                            <span className="flex items-center justify-center">
                              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processando...
                            </span>
                          ) : (
                            <>Adquirir Licença</>
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleDisconnect()}
                          className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium shadow transition-colors"
                        >
                          Desconectar Carteira
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => router.push('/app')}
                          className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-lg transition-colors"
                        >
                          Acessar SmartApp Studio
                        </button>
                        
                        <button
                          onClick={() => handleDisconnect()}
                          className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium shadow transition-colors"
                        >
                          Desconectar Carteira
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <h3 className="text-xl font-medium text-white">Criando sua licença</h3>
                  
                  {/* Lista de etapas com fundo escuro para maior legibilidade */}
                  <div className="space-y-3 bg-black/40 p-5 rounded-xl border border-gray-700">
                    {steps.map((step, index) => (
                      <TransactionStep
                        key={step.key}
                        step={`${index + 1}`}
                        title={step.title}
                        description={step.description}
                        status={getStepStatus(index)}
                        errorMessage={
                          getStepStatus(index) === 'error' ? stepError : undefined
                        }
                      />
                    ))}
                  </div>
                  
                  {/* Botões de ação */}
                  <div className="flex justify-end space-x-3 pt-4">
                    {stepStatus === 'error' ? (
                      <button
                        onClick={handleRetry}
                        className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition-colors"
                      >
                        Tentar Novamente
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowSteps(false)}
                        className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg shadow transition-colors"
                      >
                        Voltar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Additional information */}
            <div className="mt-8 text-center">
              <p className="text-gray-300 text-sm">
                Precisa de ajuda? Entre em contato com nosso suporte em{' '}
                <a href="mailto:suporte@smartapp.studio" className="text-blue-300 hover:underline">
                  suporte@smartapp.studio
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Confirmation dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-white mb-4">Confirmar desconexão</h3>
            <p className="text-gray-300 mb-6">
              {topicToDisconnect 
                ? "Tem certeza que deseja desconectar esta sessão?"
                : "Tem certeza que deseja desconectar todas as sessões ativas?"}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDisconnect}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                Desconectar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GetAccessPage; 