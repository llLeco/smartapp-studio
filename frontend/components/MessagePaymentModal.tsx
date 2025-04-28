import React, { useEffect, useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { Transaction } from '@hashgraph/sdk';
import { createMessagePaymentTransaction } from '../services/licenseService';
import { executeSignedTransaction, getTokenDetails } from '@/services/hederaService';

// Configure API base URL
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const api = (path: string) => `${BACKEND_URL}${path.startsWith('/') ? path : '/' + path}`;

// HSUITE Token ID
const HSUITE_TOKEN_ID = process.env.NEXT_PUBLIC_HSUITE_TOKEN_ID || '0.0.2203022';

// Fixed message count
const FIXED_MESSAGE_COUNT = 10;

interface MessagePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (transactionId: string, messageCount: number) => void;
  tokenId: string;
  receiverAccountId: string;
}

const MessagePaymentModal: React.FC<MessagePaymentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  tokenId,
  receiverAccountId,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingTransaction, setIsCreatingTransaction] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
  const [isLoadingTokenDetails, setIsLoadingTokenDetails] = useState(false);
  const { accountId, signTransaction } = useWallet();
  
  // Message price from environment variable
  const pricePerMessage = parseInt(process.env.NEXT_PUBLIC_MESSAGE_PRICE || "1000", 10);
  const totalPrice = FIXED_MESSAGE_COUNT * pricePerMessage;
  
  // Format display amount based on token decimals
  const getDisplayAmount = () => {
    if (tokenDecimals !== null) {
      // We already have the token's decimals info - use it directly 
      return totalPrice.toString();
    }
    return '...';
  };
  
  // Fetch token details once when the modal opens
  useEffect(() => {
    if (isOpen && tokenId === HSUITE_TOKEN_ID && tokenDecimals === null && !isLoadingTokenDetails) {
      const fetchDetails = async () => {
        try {
          setIsLoadingTokenDetails(true);
          console.log('Fetching token details for:', tokenId);
          const details = await getTokenDetails(tokenId);
          setTokenDecimals(details.decimals);
          console.log('Token details fetched, decimals:', details.decimals);
        } catch (err) {
          console.error('Error fetching token details:', err);
        } finally {
          setIsLoadingTokenDetails(false);
        }
      };
      
      fetchDetails();
    }
  }, [isOpen, tokenId, tokenDecimals, isLoadingTokenDetails]);
  
  useEffect(() => {
    // Reset transaction when modal opens
    if (isOpen) {
      setTransaction(null);
    }
  }, [isOpen]);
  
  useEffect(() => {
    // When the modal is shown and we have an accountId, create the transaction
    if (isOpen && accountId && !transaction && !isCreatingTransaction) {
      prepareTransaction();
    }
  }, [isOpen, accountId, transaction, isCreatingTransaction]);
  
  const prepareTransaction = async () => {
    if (!accountId) {
      setError('Wallet not connected');
      return;
    }
    
    try {
      setIsCreatingTransaction(true);
      setError(null);
      
      // Use the fixed message count
      const tx = await createMessagePaymentTransaction(
        tokenId,
        FIXED_MESSAGE_COUNT,
        accountId,
        receiverAccountId
      );
      
      setTransaction(tx);
      
      console.log(`Prepared transaction for ${FIXED_MESSAGE_COUNT} messages`);
    } catch (err: any) {
      console.error('Error creating transaction:', err);
      setError(err.message || 'Failed to create transaction');
    } finally {
      setIsCreatingTransaction(false);
    }
  };
  
  const handleConfirm = async () => {
    if (!transaction) {
      setError('Transaction not available');
      return;
    }
    
    try {
      setIsProcessing(true);
      setError(null);
      
      // Sign the transaction using WalletConnect
      const signedTransaction = await signTransaction(transaction);
      
      // Convert signed transaction to bytes for sending back to server
      const signedTransactionBytes = Buffer.from(signedTransaction.toBytes()).toString('base64');
      
      // Submit the signed transaction to the server
      const response = await executeSignedTransaction(signedTransactionBytes);
      console.log('Payment execution response:', response);
      
      if (response.status !== 'SUCCESS') {
        throw new Error('Payment execution failed');
      }
      
      // Call the onConfirm callback with the transaction ID
      onConfirm(response.transactionId || 'completed', FIXED_MESSAGE_COUNT);
      
    } catch (err: any) {
      console.error('Error processing payment:', err);
      setError(err.message || 'Failed to process payment');
    } finally {
      setIsProcessing(false);
    }
  };
  
  if (!isOpen) return null;
  
  const displayAmount = getDisplayAmount();
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div 
        className="relative w-full max-w-sm bg-gray-900/80 backdrop-blur-md border border-white/10 rounded-xl shadow-xl overflow-hidden"
        style={{backdropFilter: 'blur(10px)'}}
        role="dialog" 
        aria-modal="true"
      >
        {/* macOS style traffic lights */}
        <div className="flex items-center bg-gray-800/50 px-4 py-3 border-b border-white/10">
          <div className="flex space-x-2 mr-4">
            <div 
              onClick={onClose} 
              className="w-3 h-3 bg-red-500 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
            ></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <div className="flex-1 text-center">
            <h3 className="text-sm font-medium text-white">
              Purchase Messages
            </h3>
          </div>
          <div className="w-16"></div> {/* Balance the header */}
        </div>
            
        {/* Content */}
        <div className="p-5">
          <div className="sm:flex items-start mb-4">
            <div className="mr-4 mt-1 hidden sm:block">
              <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-indigo-100">
                <svg className="h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-medium text-white">
                Add more messages
              </h4>
              <p className="text-sm text-gray-300 mt-1">
                Purchase additional messages to continue your conversation
              </p>
            </div>
          </div>
          
          <div className="bg-white/10 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-300">Amount:</span>
              <span className="text-lg font-semibold text-white">{FIXED_MESSAGE_COUNT} messages</span>
            </div>
            
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-gray-300">Price per message:</span>
              <span className="text-sm font-medium text-indigo-300">{pricePerMessage} HSuite</span>
            </div>
            
            <div className="h-px bg-white/10 my-3"></div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-300">Total:</span>
              <span className="text-lg font-semibold text-indigo-300">{totalPrice} HSuite</span>
            </div>
          </div>
          
          {/* Status messages */}
          {isLoadingTokenDetails && (
            <div className="bg-indigo-900/30 border border-indigo-700 text-indigo-200 p-3 rounded-md mb-4 flex items-center text-sm">
              <svg className="animate-spin mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading token details...
            </div>
          )}
          
          {isCreatingTransaction && (
            <div className="bg-indigo-900/30 border border-indigo-700 text-indigo-200 p-3 rounded-md mb-4 flex items-center text-sm">
              <svg className="animate-spin mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Preparing transaction...
            </div>
          )}
          
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 p-3 rounded-md mb-4 text-sm">
              {error}
            </div>
          )}
          
          <div className="flex items-center justify-end space-x-3 mt-4">
            <button
              type="button"
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors"
              onClick={onClose}
            >
              Cancel
            </button>
            
            <button
              type="button"
              disabled={isProcessing || isCreatingTransaction || isLoadingTokenDetails || !transaction}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                isProcessing || isCreatingTransaction || isLoadingTokenDetails || !transaction 
                  ? 'bg-indigo-500/50 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
              onClick={handleConfirm}
            >
              {isProcessing ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </div>
              ) : 'Confirm Purchase'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagePaymentModal; 