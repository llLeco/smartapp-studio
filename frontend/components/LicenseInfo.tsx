import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { checkLicenseValidity } from '../services/licenseService';
import { useWallet } from '../hooks/useWallet';

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

interface UsageInfo {
  totalUsage: number;
  usageLimit: number;
  remainingUsage: number;
}

interface LicenseInfoProps {
  onClose: () => void;
}

const LicenseInfoComponent: React.FC<LicenseInfoProps> = ({ onClose }) => {
  const router = useRouter();
  const { accountId, isConnected, connect } = useWallet();
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLicenseInfo = async () => {
      if (!isConnected || !accountId) {
        console.log('Wallet not connected or account ID not available:', { isConnected, accountId });
        setLoading(false);
        return;
      }

      try {
        console.log('Checking license validity for account:', accountId);
        const result = await checkLicenseValidity(accountId);
        console.log('License check result:', result);
        
        const { isValid, licenseInfo: info, usageInfo: usage } = result;
        
        if (info) {
          setLicenseInfo(info as unknown as LicenseInfo);
          console.log('License Information:', {
            tokenId: info.tokenId,
            serialNumber: info.serialNumber,
            topicId: info.topicId,
            ownerId: info.ownerId,
            metadata: info.metadata
          });
          
          // Log additional metadata details if available
          if (info.metadata) {
            console.log('License Metadata:', {
              name: info.metadata.name,
              description: info.metadata.description,
              type: info.metadata.type,
              creator: info.metadata.creator,
              createdAt: info.metadata.createdAt,
            });
          }
        } else {
          console.log('No license information available');
        }
        
        if (usage) {
          setUsageInfo(usage as UsageInfo);
          console.log('Usage Information:', {
            totalUsage: usage.totalUsage,
            usageLimit: usage.usageLimit,
            remainingUsage: usage.remainingUsage,
            usagePercentage: usage.usageLimit > 0 ? 
              ((usage.totalUsage / usage.usageLimit) * 100).toFixed(2) + '%' : 'N/A'
          });
        } else {
          console.log('No usage information available');
        }
        
        if (!isValid) {
          console.log('License validity check failed - License is not valid');
          setError('You do not have a valid license.');
        } else {
          console.log('License is valid');
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Error checking license information';
        console.error('Error checking license:', err);
        console.log('License check error details:', {
          message: errorMessage,
          stack: err.stack,
          accountId
        });
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    console.log('LicenseInfo component mounted', { isConnected, accountId });
    fetchLicenseInfo();
  }, [isConnected, accountId]);

  const handleConnect = async () => {
    try {
      console.log('Attempting to connect wallet');
      await connect();
      console.log('Wallet connected successfully');
    } catch (err: any) {
      const errorMessage = err.message || 'Error connecting wallet';
      console.error('Error connecting wallet:', err);
      console.log('Wallet connection error details:', {
        message: errorMessage,
        stack: err.stack
      });
      setError(errorMessage);
    }
  };

  // Log when license data changes
  useEffect(() => {
    if (licenseInfo || usageInfo) {
      console.log('License Dashboard Data:', {
        licenseInfo,
        usageInfo,
        accountId,
        isConnected,
        hasError: !!error,
        error
      });
    }
  }, [licenseInfo, usageInfo, accountId, isConnected, error]);

  if (loading) {
    return (
      <div className="p-6 backdrop-blur-lg bg-black/30 rounded-xl border border-white/10 text-white">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Informações da Licença</h2>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }
  
  if (error || !licenseInfo) {
    return (
      <div className="p-6 backdrop-blur-lg bg-black/30 rounded-xl border border-white/10 text-white">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Informações da Licença</h2>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <div className="bg-red-900/30 border border-red-500/40 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span className="text-red-300">{error || 'Não foi possível carregar as informações da licença'}</span>
          </div>
        </div>
        
        <div className="text-center">
          <button
            onClick={() => window.location.href = '/get-access'}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-md"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
            Obter Licença
          </button>
        </div>
      </div>
    );
  }
  
  // Calculate days remaining if createdAt exists
  const getDaysRemaining = () => {
    if (!licenseInfo.metadata.createdAt) return 'N/A';
    
    const createdDate = new Date(licenseInfo.metadata.createdAt);
    const expiryDate = new Date(createdDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1); // Assuming 1 year license
    
    const now = new Date();
    const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysRemaining > 0 ? daysRemaining : 0;
  };
  
  return (
    <div className="p-6 backdrop-blur-lg bg-black/30 rounded-xl border border-white/10 text-white">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Informações da Licença</h2>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <div className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border border-blue-500/30 rounded-xl p-5 mb-6">
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{licenseInfo.metadata.name}</h3>
            <p className="text-blue-300 text-sm">{licenseInfo.metadata.type} ativo</p>
          </div>
          <div className="ml-auto">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-300">
              Ativo
            </span>
          </div>
        </div>
        
        <p className="text-gray-300 text-sm mb-4">{licenseInfo.metadata.description}</p>
        
        {licenseInfo.metadata.createdAt && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-black/30 rounded-lg p-3">
              <p className="text-xs text-gray-300 mb-1">Data de Ativação</p>
              <p className="text-sm font-medium text-white">{new Date(licenseInfo.metadata.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-3">
              <p className="text-xs text-gray-300 mb-1">Dias Restantes</p>
              <p className="text-sm font-medium text-white">{getDaysRemaining()} dias</p>
            </div>
          </div>
        )}
        
        {usageInfo && (
          <div className="mb-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm text-gray-300">Uso da API</span>
              <span className="text-xs font-medium text-white">
                {usageInfo.remainingUsage}/{usageInfo.usageLimit}
              </span>
            </div>
            <div className="w-full h-2 bg-black/50 rounded-full">
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
      
      <div className="space-y-4">
        <div className="bg-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-300 mb-1">Token ID</p>
          <p className="font-mono text-sm truncate text-white">{licenseInfo.tokenId}</p>
        </div>
        
        <div className="bg-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-300 mb-1">Topic ID</p>
          <p className="font-mono text-sm truncate text-white">{licenseInfo.topicId}</p>
        </div>
        
        <div className="bg-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-300 mb-1">Serial Number</p>
          <p className="font-mono text-sm text-white">{licenseInfo.serialNumber}</p>
        </div>
        
        <div className="bg-white/10 rounded-lg p-4">
          <p className="text-xs text-gray-300 mb-1">Owner ID</p>
          <p className="font-mono text-sm truncate text-white">{licenseInfo.ownerId}</p>
        </div>
      </div>
    </div>
  );
};

export default LicenseInfoComponent; 