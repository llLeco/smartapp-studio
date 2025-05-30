import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '../hooks/useWallet';
import { licenseService } from '../services';
import Head from 'next/head';
import PageBackground from '../components/PageBackground';

// Interfaces for typing
interface NftMetadata {
  name: string;
  description: string;
  topicId?: string;
  creator?: string;
  createdAt?: string;
  type: string;
  image?: string;
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
const AccessCard: React.FC<AccessCardProps> = ({ licenseInfo, accountId, activeSessions, onDisconnect }) => {
  if (!licenseInfo) {
    return (
      <div className="p-6 backdrop-blur-lg bg-black/40 rounded-xl border border-gray-700 shadow-xl">
        <h3 className="text-xl font-medium text-white">No Active License</h3>
        <p className="mt-2 text-gray-300">
          You don't have a license to access SmartApp Studio yet.
        </p>
        {accountId && (
          <div className="mt-3 mb-4 px-3 py-2 bg-gray-800 rounded">
            <p className="text-sm text-gray-300">Account ID: {accountId}</p>
          </div>
        )}
        
        {activeSessions.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-white mb-2">Active sessions:</h4>
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
                    Disconnect
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
        <h3 className="text-xl font-medium text-white">SmartApp License</h3>
        <span className="px-2 py-1 bg-green-900 text-green-300 text-xs rounded-full">
          Active
        </span>
      </div>
      
      {/* License image */}
      {(
        <div className="mt-4 flex justify-center">
          <img 
            src={'https://bafybeibhak25l3754uor4onzwqpeuq44wuhgxopi46e434q6quwija6g64.ipfs.w3s.link/ChatGPT%20Image%202%20de%20mai.%20de%202025%2C%2011%5F26%5F14.png'} 
            alt="License NFT" 
            className="w-full max-w-[200px] h-auto rounded-lg border border-gray-600"
          />
        </div>
      )}
      
      {/* License details */}
      <div className="mt-4 grid gap-3">
        <div className="flex justify-between">
          <span className="text-gray-400">License NFT ID:</span>
          <span className="text-white font-mono">{licenseInfo.tokenId}:{licenseInfo.serialNumber}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-400">Topic:</span>
          <span className="text-white font-mono text-xs truncate max-w-[200px]">{licenseInfo.topicId}</span>
        </div>
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-700">
        <p className="text-sm text-gray-400">
          {accountId ? `Connected as: ${accountId}` : 'Not connected'}
        </p>
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
        Processing...
      </span>
    ) : (
      <span>Get Access</span>
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
        <span>Verifying license...</span>
      </div>
    );
  }

  if (isValid) {
    return (
      <div className="flex items-center space-x-2 text-green-400">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>Valid license</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 text-yellow-300">
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
      </svg>
      <span>License not found</span>
    </div>
  );
};

const GetAccessPage = () => {
  const router = useRouter();
  const { accountId, isConnected, connect, disconnect, disconnectSession, activeSessions } = useWallet();
  const [loading, setLoading] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
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
      key: 'createLicense', 
      title: 'Creating License', 
      description: 'Creating and minting your license token' 
    },
    { 
      key: 'associateLicenseToken', 
      title: 'Associating License Token', 
      description: 'Associating license token to your account' 
    },
    { 
      key: 'receiveNft', 
      title: 'Receiving NFT', 
      description: 'Recording license in your wallet' 
    },
    {
      key: 'associateHsuiteToken',
      title: 'Associating HSUITE Token',
      description: 'Associating HSUITE token to your account'
    },
    {
      key: 'receiveHsuiteTokens',
      title: 'Receiving 200 HSUITEs',
      description: 'Receiving 200 HSUITEs in your wallet'
    },
    {
      key: 'complete',
      title: 'Complete',
      description: 'License and HSUITE NFT associated successfully'
    }
  ];

  // Check if user has a valid license
  useEffect(() => {
    const checkLicense = async () => {
      if (isConnected && accountId) {
        try {
          setChecking(true);
          setError('');
          
          const license = await licenseService.getUserLicense(accountId);
          
          if (license) {
            setLicenseInfo(license);
          }

        } catch (err: any) {
          console.error('Error checking license:', err);
          setError(err.message || 'Error checking license');
        } finally {
          setChecking(false);
        }
      } else {
        setChecking(false);
      }
    };

    checkLicense();
  }, [isConnected, accountId]);

  // Handler to start the license process
  const handleStartLicenseProcess = async () => {
    if (!isConnected || !accountId) {
      try {
        await connect();
        return; // Wait for the connect to trigger a re-render
      } catch (err) {
        console.error('Error connecting wallet:', err);
        return;
      }
    }
    
    setShowSteps(true);
    setCurrentStepIndex(0);
    setCurrentStep('createLicense');
    setStepStatus('pending');
    setStepError(undefined);
    setLicenseProcessData({});
    
    // Start the process
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
        case 'createLicense': {
          // Merge createTopic and mintToken steps
          const metadata: NftMetadata = {
            name: 'SmartApp License',
            description: 'Access license for SmartApp Studio',
            type: 'LICENSE'
          };
          
          // Step 1: Prepare metadata with account ID
          console.log("Starting license topic creation...");
          const { fullMetadata } = await licenseService.prepareMetadata(metadata);
          
          // Step 2: Create topic
          const topicResult = await licenseService.createLicenseTopic(fullMetadata);
          
          if ('error' in topicResult) {
            console.error("Error creating license topic:", topicResult.error);
            throw new Error(`Failed to create license topic: ${topicResult.error}`);
          }
          
          const { topicId, tokenId } = topicResult;
          console.log(`Topic created: ${topicId}, Token ID: ${tokenId}`);
          
          setLicenseProcessData({
            topicId,
            tokenId
          });
          
          // Step 3: Mint token
          console.log("Starting token minting...");
          const mintResult = await licenseService.mintLicenseToken(tokenId, topicId);
          
          if ('error' in mintResult) {
            console.error("Error minting token:", mintResult.error);
            throw new Error(`Failed to mint license token: ${mintResult.error}`);
          }
          
          const { serialNumber } = mintResult;
          console.log(`Token minted with serial number: ${serialNumber}`);
          
          setLicenseProcessData(prev => ({
            ...prev,
            serialNumber
          }));

          console.log("License process data:", licenseProcessData);
          
          // Move to associateLicenseToken step
          setCurrentStep('associateLicenseToken');
          setCurrentStepIndex(1);
          setStepStatus('pending');
          break;
        }
        
        case 'associateLicenseToken': {
          // Check if we have the minimum required data
          if (!licenseProcessData.tokenId) {
            console.error("Missing required license data:", licenseProcessData);
            throw new Error("Missing token ID for license");
          }

          // Log what we have before proceeding
          console.log("License data for association step:", licenseProcessData);
          
          // Associate license token
          console.log("Starting license token association...");
          const associateResult = await licenseService.associateLicenseToken(accountId);
          
          if ('error' in associateResult) {
            console.error("Error associating token:", associateResult.error);
            throw new Error(`Failed to associate license token: ${associateResult.error}`);
          }
          
          // Move to receiveNft step
          setCurrentStep('receiveNft');
          setCurrentStepIndex(2);
          setStepStatus('pending');
          break;
        }
        
        case 'receiveNft': {

          if (!licenseProcessData.tokenId || !licenseProcessData.topicId || !licenseProcessData.serialNumber) {
            throw new Error("Missing required license data for token transfer");
          }

          await licenseService.recordLicenseMessage(
            licenseProcessData.topicId, 
            licenseProcessData.tokenId, 
            licenseProcessData.serialNumber, {
            name: 'SmartApp License #' + licenseProcessData.serialNumber + ' - ' + accountId,
            description: 'Access license for SmartApp Studio',
            type: 'LICENSE',
            creator: accountId,
            createdAt: new Date().toISOString()
          }
        );
          
          // Step: Transfer license token
          console.log("Transferring license token...");
          const transferResult = await licenseService.transferLicenseToken(
            licenseProcessData.tokenId,
            licenseProcessData.serialNumber || 1,
            accountId || ''
          );
    
          console.log("transferResult", transferResult);
          
          if ('error' in transferResult) {
            // If error is not related to the user already owning the token,
            // we'll show a warning but still continue
            console.warn("License transfer encountered an issue:", transferResult.error);
            console.log("Continuing process as license has been recorded in topic");
          } else {
            console.log(`License transfer successful with status: ${transferResult.status}`);
          }
          
          setStepStatus('success');
          
          // Check license after all steps
          const license = await licenseService.getUserLicense(accountId || '');
          if (license) {
            setLicenseInfo(license);
            console.log("License verified and loaded successfully");
          } else {
            console.log("License not found by getUserLicense, but creation was successful");
            
            // Create a manual license info object since the getUserLicense might not find it immediately
            setLicenseInfo({
              tokenId: licenseProcessData.tokenId,
              serialNumber: licenseProcessData.serialNumber,
              topicId: licenseProcessData.topicId,
              metadata: {
                name: 'SmartApp License',
                description: 'Access license for SmartApp Studio',
                type: 'LICENSE',
                creator: accountId || '',
                createdAt: new Date().toISOString(),
              },
              ownerId: accountId || ''
            });
          }
          
          // Show success message to the user
          setError(''); // Clear any previous errors

          setCurrentStep('associateHsuiteToken');
          setCurrentStepIndex(3);
          setStepStatus('pending');
          break;
        }

        case 'associateHsuiteToken': {
          // Associate HSUITE token
          console.log("Starting HSUITE token association...");
          const associateResult = await licenseService.associateHsuiteToken(accountId);
          
          if ('error' in associateResult) {
            console.error("Error associating HSUITE token:", associateResult.error);
            throw new Error(`Failed to associate HSUITE token: ${associateResult.error}`);
          }
          
          // Move to receiveHsuiteTokens step
          setCurrentStep('receiveHsuiteTokens');
          setCurrentStepIndex(4);
          setStepStatus('pending');
          break;
        }

        case 'receiveHsuiteTokens': {
          // Get HSUITE token ID
          const hsuiteTokenIdRes = await fetch('/api/hedera?type=hsuitetokenid');
          const hsuiteTokenIdData = await hsuiteTokenIdRes.json();
          const hsuiteTokenId = hsuiteTokenIdData.tokenId;

          if (!hsuiteTokenId) {
            throw new Error("Failed to get HSUITE token ID");
          }

          // Transfer HSUITE token
          console.log("Transferring HSUITE token...");
          const transferResult = await licenseService.transferHsuiteToken(
            hsuiteTokenId,
            accountId
          );
          
          if ('error' in transferResult) {
            console.error("Error transferring HSUITE token:", transferResult.error);
            throw new Error(`Failed to transfer HSUITE token: ${transferResult.error}`);
          }
          
          // Move to complete step
          setCurrentStep('complete');
          setCurrentStepIndex(5);
          setStepStatus('pending');

          await handleCompleteStep();
          break;
        }
      }
    } catch (err: any) {
      console.error('Error in license process:', err);
      setStepStatus('error');
      
      // Format error message for display
      const errorMessage = err.message || 'Error in license process';
      setStepError(errorMessage);
      setError(errorMessage);
      
      // Log additional debugging info
      console.log('Current step:', currentStep);
      console.log('License process data:', licenseProcessData);
    } finally {
      setLoading(false);
    }
  };

  // Separate function to handle the complete step
  const handleCompleteStep = async () => {
    try {
      setTimeout(() => {
        router.push('/app');
      }, 2000);
    } catch (err: any) {
      console.error('Error in complete step:', err);
      setStepStatus('error');
      setStepError(err.message || 'Error completing license creation');
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

  // Handler to disconnect wallet
  const handleDisconnect = (topic?: string) => {
    setTopicToDisconnect(topic);
    setShowConfirmation(true);
  };
  
  // Confirm disconnection
  const confirmDisconnect = async () => {
    try {
      if (topicToDisconnect) {
        await disconnectSession(topicToDisconnect);
      } else {
        await disconnect();
      }
      setShowConfirmation(false);
    } catch (err) {
      console.error('Error disconnecting:', err);
    }
  };

  return (
    <>
      <Head>
        <title>Get Access | SmartApp Studio</title>
        <meta name="description" content="Get access to SmartApp Studio" />
      </Head>
      
      <div className="min-h-screen relative pb-16">
        <PageBackground />
        
        <div className="relative z-10 container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white">SmartApp Studio Access</h1>
              <p className="text-gray-300 mt-2">
                Connect your wallet to verify or purchase a license
              </p>
            </div>
            
            <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
              {/* License status */}
              <div className="mb-6">
                {checking ? (
                  <div className="flex items-center space-x-2 text-gray-300">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Checking license...</span>
                  </div>
                ) : licenseInfo ? (
                  <div className="flex items-center space-x-2 text-green-400">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span>Valid license</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-yellow-300">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                    <span>License not found</span>
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
                  {/* License card */}
                  <div className="mb-6">
                    <AccessCard 
                      licenseInfo={licenseInfo} 
                      accountId={accountId} 
                      activeSessions={activeSessions}
                      onDisconnect={handleDisconnect}
                    />
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex flex-col space-y-4">
                    {!isConnected ? (
                      <button
                        onClick={() => connect()}
                        className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-lg transition-colors"
                      >
                        Connect Wallet
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
                              Processing...
                            </span>
                          ) : (
                            <>Purchase License</>
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleDisconnect()}
                          className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium shadow transition-colors"
                        >
                          Disconnect Wallet
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => router.push('/app')}
                          className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-lg transition-colors"
                        >
                          Access SmartApp Studio
                        </button>
                        
                        <button
                          onClick={() => handleDisconnect()}
                          className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium shadow transition-colors"
                        >
                          Disconnect Wallet
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <h3 className="text-xl font-medium text-white">Creating your license</h3>
                  
                  {/* List of steps with dark background for better readability */}
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
                  
                  {/* Action buttons */}
                  <div className="flex justify-end space-x-3 pt-4">
                    {stepStatus === 'error' ? (
                      <button
                        onClick={handleRetry}
                        className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow transition-colors"
                      >
                        Try Again
                      </button>
                    ) : currentStep !== 'complete' ? (
                      <>
                        <button
                          onClick={() => setShowSteps(false)}
                          className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg shadow transition-colors"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleNextStep}
                          disabled={loading}
                          className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow transition-colors disabled:opacity-50"
                        >
                          {loading ? (
                            <span className="flex items-center">
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processing...
                            </span>
                          ) : (
                            'Next'
                          )}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setShowSteps(false)}
                        className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg shadow transition-colors"
                      >
                        Back
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Additional information */}
            <div className="mt-8 text-center">
              <p className="text-gray-300 text-sm">
                Need help? Contact our support at{' '}
                <a href="mailto:support@smartapp.studio" className="text-blue-300 hover:underline">
                  support@smartapp.studio
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
            <h3 className="text-lg font-medium text-white mb-4">Confirm disconnection</h3>
            <p className="text-gray-300 mb-6">
              {topicToDisconnect 
                ? "Are you sure you want to disconnect this session?"
                : "Are you sure you want to disconnect all active sessions?"}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmDisconnect}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GetAccessPage; 