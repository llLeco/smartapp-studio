import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '../hooks/useWallet';
import * as licenseService from '../services/licenseService';
import Head from 'next/head';

// Interfaces para tipagem
interface NftMetadata {
  name: string;
  description: string;
  topicId?: string;
  creator?: string;
  createdAt?: string;
  type: string;
  additionalProperties?: Record<string, any>;
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
          <div className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-700 flex items-center justify-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">{step}</span>
          </div>
        )}
        {status === 'current' && (
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 border-2 border-blue-500 dark:border-blue-600 flex items-center justify-center">
            <svg className="animate-spin h-4 w-4 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
        {status === 'completed' && (
          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 border-2 border-green-500 dark:border-green-600 flex items-center justify-center">
            <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        )}
        {status === 'error' && (
          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 border-2 border-red-500 dark:border-red-600 flex items-center justify-center">
            <svg className="h-4 w-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1">
        <h4 className={`font-medium ${
          status === 'completed' ? 'text-green-600 dark:text-green-400' : 
          status === 'current' ? 'text-blue-600 dark:text-blue-400' :
          status === 'error' ? 'text-red-600 dark:text-red-400' :
          'text-gray-700 dark:text-gray-300'
        }`}>
          {title}
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
        {status === 'error' && errorMessage && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errorMessage}</p>
        )}
      </div>
    </div>
  );
};

// Componentes internos
const AccessCard: React.FC<AccessCardProps> = ({ licenseInfo, accountId, usageInfo }) => {
  if (!licenseInfo) {
    return (
      <div className="p-6 backdrop-blur-lg bg-white/10 dark:bg-black/20 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xl">
        <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200">Sem Licença Ativa</h3>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Você ainda não possui uma licença para acessar o SmartApp Studio.
        </p>
        {accountId && (
          <div className="mt-3 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded">
            <p className="text-sm text-gray-500 dark:text-gray-400">Account ID: {accountId}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 backdrop-blur-lg bg-white/10 dark:bg-black/20 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xl">
      <div className="flex justify-between items-start">
        <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200">Licença SmartApp</h3>
        <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs rounded-full">
          Ativa
        </span>
      </div>
      
      <div className="mt-4 space-y-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Token ID</p>
          <p className="font-mono text-sm text-gray-800 dark:text-gray-200">{licenseInfo.tokenId}</p>
        </div>
        
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Topic ID</p>
          <p className="font-mono text-sm text-gray-800 dark:text-gray-200">{licenseInfo.topicId}</p>
        </div>
        
        {usageInfo && (
          <div className="mt-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">Uso restante</span>
              <span className="text-sm font-medium">
                {usageInfo.remainingUsage}/{usageInfo.usageLimit}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
              <div 
                className="h-full bg-blue-500 rounded-full" 
                style={{ 
                  width: `${(usageInfo.remainingUsage / usageInfo.usageLimit) * 100}%` 
                }}
              />
            </div>
          </div>
        )}
      </div>
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
      <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
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
      <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>Licença válida</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 text-yellow-600 dark:text-yellow-400">
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

const GetAccess: React.FC = () => {
  const router = useRouter();
  const { accountId, isConnected, connect, connector } = useWallet();
  const [loading, setLoading] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [error, setError] = useState<string>('');
  
  // State for multi-step license creation
  const [showSteps, setShowSteps] = useState<boolean>(false);
  const [licenseState, setLicenseState] = useState<licenseService.LicenseCreationState | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  // Define steps
  const steps = [
    { 
      key: 'createTopic', 
      title: 'Criar Tópico', 
      description: 'Criando um tópico para a licença no Hedera Consensus Service',
      action: licenseService.createLicenseTopic 
    },
    { 
      key: 'mintToken', 
      title: 'Criar NFT', 
      description: 'Gerando o NFT da licença com os metadados',
      action: licenseService.mintLicenseToken 
    },
    { 
      key: 'associateToken', 
      title: 'Associar Token', 
      description: 'Associando a licença NFT à sua conta',
      action: licenseService.associateLicenseToken 
    },
    { 
      key: 'recordMessage', 
      title: 'Registrar Licença', 
      description: 'Registrando informações da licença no tópico',
      action: licenseService.recordLicenseMessage 
    },
    { 
      key: 'transferToken', 
      title: 'Transferir NFT', 
      description: 'Transferindo a licença NFT para sua conta com pagamento',
      action: licenseService.transferLicenseWithSubscription 
    }
  ];

  useEffect(() => {
    const checkLicense = async () => {
      if (!isConnected || !accountId) {
        setChecking(false);
        return;
      }

      try {
        setChecking(true);
        const { isValid, licenseInfo: info, usageInfo: usage } = await licenseService.checkLicenseValidity(accountId);
        
        if (info) {
          setLicenseInfo(info as unknown as LicenseInfo);
        }
        
        if (usage) {
          setUsageInfo(usage as UsageInfo);
        }
        
        if (isValid) {
          // Redireciona para o app se a licença for válida
          setTimeout(() => {
            router.push('/app');
          }, 1500);
        }
      } catch (err) {
        console.error('Erro ao verificar licença:', err);
      } finally {
        setChecking(false);
      }
    };

    checkLicense();
  }, [isConnected, accountId, router]);

  const handleStartLicenseProcess = async () => {
    if (!isConnected) {
      await connect();
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const metadata: NftMetadata = {
        name: "SmartApp Studio License",
        description: "Esta NFT concede acesso ao SmartApp Studio",
        type: "LICENSE",
        additionalProperties: {
          initialLimit: 100,
          createdAt: new Date().toISOString()
        }
      };
      
      const initialState = await licenseService.initLicenseCreation(metadata);
      setLicenseState(initialState);
      setShowSteps(true);
      setCurrentStepIndex(0);
      
    } catch (err: any) {
      console.error('Erro ao iniciar processo de licença:', err);
      setError(err.message || 'Erro ao iniciar o processo de licença');
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = async () => {
    if (!licenseState) return;
    
    try {
      setLoading(true);
      
      const step = steps[currentStepIndex];
      console.log(`Executando passo: ${step.key}`);
      
      const updatedState = await step.action(licenseState);
      setLicenseState(updatedState);
      
      if (updatedState.error) {
        setError(updatedState.error);
        return;
      }
      
      // Move to next step
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
      } else {
        // Process complete
        if (updatedState.step === 'complete') {
          // Convert to license info format for display
          const newLicenseInfo: LicenseInfo = {
            tokenId: updatedState.tokenId!,
            serialNumber: updatedState.serialNumber!,
            topicId: updatedState.topicId!,
            metadata: updatedState.metadata!,
            ownerId: updatedState.accountId!
          };
          
          setLicenseInfo(newLicenseInfo);
          setShowSteps(false);
          
          // Redirect to app
          setTimeout(() => {
            router.push('/app');
          }, 1500);
        }
      }
    } catch (err: any) {
      console.error('Erro ao processar passo:', err);
      setError(err.message || 'Erro ao processar passo');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    // Reset all states to start from zero
    setError('');
    setLicenseState(null);
    setCurrentStepIndex(0);
    setShowSteps(false);
    
    // Restart the process
    handleStartLicenseProcess();
  };

  const getStepStatus = (stepIndex: number): 'waiting' | 'current' | 'completed' | 'error' => {
    if (!licenseState) return 'waiting';
    
    const stepKey = steps[stepIndex].key;
    
    if (licenseState.error && stepKey === licenseState.step) {
      return 'error';
    }
    
    if (stepIndex === currentStepIndex) {
      return 'current';
    }
    
    if (stepIndex < currentStepIndex) {
      return 'completed';
    }
    
    return 'waiting';
  };

  const handleCreateLicense = async () => {
    if (!isConnected) {
      await connect();
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const metadata: NftMetadata = {
        name: "SmartApp Studio License",
        description: "Esta NFT concede acesso ao SmartApp Studio",
        type: "LICENSE",
        additionalProperties: {
          initialLimit: 100,
          createdAt: new Date().toISOString()
        }
      };
      
      console.log("Iniciando criação da licença...");
      const result = await licenseService.createLicenseNft(metadata);
      console.log("Licença criada com sucesso:", result);
      
      if (result) {
        // Precisamos converter o resultado para o formato esperado de licenseInfo
        const licenseData: LicenseInfo = {
          tokenId: result.tokenId,
          serialNumber: result.serialNumber,
          topicId: result.topicId,
          metadata: result.metadata,
          ownerId: accountId || ''
        };
        
        setLicenseInfo(licenseData);
        // Redireciona para o app após a criação da licença
        router.push('/app');
      }
    } catch (err: any) {
      console.error('Erro ao criar licença:', err);
      // Exibe uma mensagem mais descritiva do erro para ajudar a depuração
      let errorMessage = 'Não foi possível criar sua licença. ';
      
      if (err?.message) {
        // Extrair a parte mais relevante da mensagem de erro
        if (err.message.includes('nodeAccountId')) {
          errorMessage += 'Erro de configuração da rede Hedera. Verifique a conexão com a rede.';
        } else if (err.message.includes('sign')) {
          errorMessage += 'Problema ao assinar a transação. Reconecte sua carteira.';
        } else if (err.message.includes('Wallet')) {
          errorMessage += err.message;
        } else {
          errorMessage += `Erro: ${err.message}`;
        }
      } else {
        errorMessage += 'Tente novamente ou contate o suporte.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Obter Acesso | SmartApp Studio</title>
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Container principal com efeito de aba de navegador */}
          <div className="relative backdrop-blur-md bg-white/70 dark:bg-black/40 rounded-xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-700">
            {/* Header de "aba de navegador" */}
            <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 flex items-center border-b border-gray-200 dark:border-gray-700">
              <div className="flex space-x-2 mr-4">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="flex-1 text-center">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Acesso SmartApp Studio</span>
              </div>
            </div>
            
            {/* Conteúdo principal */}
            <div className="p-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Smart<span className="text-blue-600">App</span> Studio</h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  Desenvolva apps inteligentes com IA e HSuite
                </p>
              </div>
              
              {!showSteps && (
                <>
                  <div className="mb-6">
                    <LicenseStatus isValid={!!licenseInfo} checking={checking} />
                  </div>
                  
                  <div className="mb-6">
                    <AccessCard 
                      licenseInfo={licenseInfo}
                      accountId={accountId}
                      usageInfo={usageInfo}
                    />
                  </div>
                </>
              )}
              
              {showSteps && (
                <div className="mb-6 p-4 bg-white/80 dark:bg-gray-800/80 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">Criando sua licença</h3>
                  
                  <div className="space-y-5">
                    {steps.map((step, index) => (
                      <TransactionStep
                        key={step.key}
                        step={`${index + 1}`}
                        title={step.title}
                        description={step.description}
                        status={getStepStatus(index)}
                        errorMessage={licenseState?.error && licenseState.step === step.key ? licenseState.error : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {error && showSteps && (
                <div className="mb-6 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm rounded-lg">
                  <p>{error}</p>
                </div>
              )}
              
              <div className="space-y-4">
                {!isConnected ? (
                  <button
                    onClick={connect}
                    className="w-full flex justify-center items-center py-3 px-4 border border-gray-300 dark:border-gray-600 text-md font-medium rounded-xl text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow transition-all duration-300"
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2"/>
                      <path d="M12 8V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M8 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Conectar Carteira
                  </button>
                ) : showSteps ? (
                  <div className="flex space-x-3">
                    {licenseState?.error && (
                      <button
                        onClick={handleRetry}
                        className="flex-1 flex justify-center items-center py-3 px-4 border border-red-300 dark:border-red-700 text-md font-medium rounded-xl text-red-700 dark:text-red-300 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow transition-all duration-300"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                        Reiniciar
                      </button>
                    )}
                    <button
                      onClick={handleNextStep}
                      disabled={loading}
                      className={`${licenseState?.error ? 'flex-1' : 'w-full'} flex justify-center py-3 px-4 border border-transparent text-lg font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-lg transition-all duration-300`}
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
                        <span>{licenseState?.error ? 'Tentar novamente' : 'Próximo'}</span>
                      )}
                    </button>
                  </div>
                ) : !licenseInfo ? (
                  <button
                    onClick={handleStartLicenseProcess}
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
                ) : (
                  <button
                    onClick={() => router.push('/app')}
                    className="w-full flex justify-center py-3 px-4 text-md font-medium rounded-xl text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-lg transition-all duration-300"
                  >
                    Acessar SmartApp Studio
                  </button>
                )}
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 text-center text-xs text-gray-500 dark:text-gray-400">
              Powered by Hedera Hashgraph • Tokenized Access
            </div>
          </div>
          
          {/* Sombra de elevação */}
          <div className="absolute inset-0 z-[-1] bg-gradient-to-b from-blue-500/20 to-purple-500/20 blur-3xl opacity-30 transform scale-95 rounded-full"></div>
        </div>
      </div>
    </>
  );
};

export default GetAccess; 