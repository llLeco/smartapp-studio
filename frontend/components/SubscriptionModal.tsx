import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useWallet } from '../hooks/useWallet';
import { Transaction } from '@hashgraph/sdk';
import { createPaymentTransaction, getTokenDetails } from '../services/licenseService';

// Configure backend URL base
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const api = (path: string) => `${BACKEND_URL}${path.startsWith('/') ? path : '/' + path}`;

// HSUITE Token ID
const HSUITE_TOKEN_ID = process.env.NEXT_PUBLIC_HSUITE_TOKEN_ID || '0.0.2203022';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (transactionId: string) => void;
  tokenId: string;
  receiverAccountId: string;
  isRenewal?: boolean;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  tokenId,
  receiverAccountId: propReceiverAccountId, // Rename to indicate it's from props
  isRenewal = false
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingTransaction, setIsCreatingTransaction] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [displayAmount, setDisplayAmount] = useState<string>('...');
  const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
  const [isLoadingTokenDetails, setIsLoadingTokenDetails] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [shouldPrepareTransaction, setShouldPrepareTransaction] = useState(false);
  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [isLoadingOperatorId, setIsLoadingOperatorId] = useState(false);
  const { accountId, signTransaction } = useWallet();
  // DOM element for portal
  const [modalRoot, setModalRoot] = useState<HTMLElement | null>(null);
  // Flag to prevent infinite loops
  const transactionPrepared = useRef(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState<{ subscriptionId: string; expiresAt: string } | null>(null);
  const isSubmitting = useRef(false); // Add ref to track submission state
  const [transactionId, setTransactionId] = useState<string | null>(null);
  
  // Subscription price in USD - from environment variable 
  const subscriptionPriceUSD = parseInt(process.env.NEXT_PUBLIC_SUBSCRIPTION_PRICE || "20", 10);
  
  // Get conversion rate from environment variable or use default
  const hsuitePerUSD = parseInt(process.env.NEXT_PUBLIC_HSUITE_PER_USD || "1", 10);
  
  // Calculate total HSuite tokens needed
  const hsuiteAmount = subscriptionPriceUSD * hsuitePerUSD;
  
  // Set up the portal target
  useEffect(() => {
    if (typeof document !== 'undefined') {
      setModalRoot(document.body);
    }
  }, []);
  
  // Fetch token details once when the modal opens
  useEffect(() => {
    if (isOpen && tokenId === HSUITE_TOKEN_ID && tokenDecimals === null && !isLoadingTokenDetails) {
      const fetchDetails = async () => {
        try {
          setIsLoadingTokenDetails(true);
          console.log('Fetching token details for:', tokenId);
          const details = await getTokenDetails(tokenId);
          setTokenDecimals(details.decimals);
          setDisplayAmount(formatAmount(hsuiteAmount, details.decimals));
          console.log('Token details fetched, decimals:', details.decimals);
        } catch (err) {
          console.error('Error fetching token details:', err);
          setDisplayAmount(hsuiteAmount.toString());
        } finally {
          setIsLoadingTokenDetails(false);
        }
      };
      
      fetchDetails();
    } else if (isOpen && tokenId !== HSUITE_TOKEN_ID) {
      // For other tokens, just set the display amount directly
      setDisplayAmount(hsuiteAmount.toString());
    }
  }, [isOpen, tokenId, tokenDecimals, isLoadingTokenDetails, hsuiteAmount]);
  
  // Fetch operator ID when the modal opens
  useEffect(() => {
    if (isOpen && !operatorId && !isLoadingOperatorId) {
      const fetchOperatorId = async () => {
        try {
          setIsLoadingOperatorId(true);
          console.log('Fetching operator ID from backend...');
          const response = await fetch(api('/api/hedera/getOperatorId'));
          const result = await response.json();
          
          if (!result.success || !result.data) {
            throw new Error(result.error || 'Failed to get operator ID');
          }
          
          console.log('Operator ID fetched:', result.data);
          setOperatorId(result.data);
        } catch (err) {
          console.error('Error fetching operator ID:', err);
          setError('Failed to get receiver account information. Please try again.');
        } finally {
          setIsLoadingOperatorId(false);
        }
      };
      
      fetchOperatorId();
    }
  }, [isOpen, operatorId, isLoadingOperatorId]);
  
  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setTransaction(null);
      setError(null);
      setIsSuccess(false);
      setSubscriptionDetails(null);
      setRetryCount(0);
      transactionPrepared.current = false;
      setShouldPrepareTransaction(true);
      isSubmitting.current = false;
    } else {
      // Reset when modal closes
      transactionPrepared.current = false;
    }
  }, [isOpen]);
  
  // Effect to prepare transaction when needed
  useEffect(() => {
    // Only prepare transaction when we have the operator ID and account ID
    if (shouldPrepareTransaction && accountId && operatorId && !isCreatingTransaction && !transactionPrepared.current) {
      console.log('Preparing transaction for account:', accountId);
      prepareTransaction();
      setShouldPrepareTransaction(false);
    }
  }, [shouldPrepareTransaction, accountId, operatorId, isCreatingTransaction]);
  
  // Effect to retry transaction creation
  useEffect(() => {
    if (retryCount > 0 && retryCount <= 3 && !transactionPrepared.current) {
      setShouldPrepareTransaction(true);
    }
  }, [retryCount]);
  
  // Format amount with proper decimals
  const formatAmount = (amount: number, decimals: number): string => {
    if (decimals === 0) return amount.toString();
    
    // For display purposes only
    const amountWithCommas = amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return amountWithCommas;
  };
  
  const prepareTransaction = async () => {
    if (!accountId) {
      setError('Wallet not connected');
      return;
    }
    
    if (!operatorId) {
      setError('Receiver account not available');
      return;
    }
    
    try {
      console.log('Creating transaction...');
      setIsCreatingTransaction(true);
      setError(null);
      
      // Calculate the proper transaction amount based on token decimals
      let transactionAmount = hsuiteAmount;
      
      if (tokenId === HSUITE_TOKEN_ID) {
        console.log('Preparing HSUITE token transaction');
        // Fetch token details if not already done
        if (tokenDecimals === null) {
          console.log('No token decimals available, fetching...');
          try {
            const details = await getTokenDetails(tokenId);
            console.log('Token details fetched:', details);
            setTokenDecimals(details.decimals);
            // Calculate with proper scaling factor (multiply by 10^decimals)
            const multiplier = Math.pow(10, details.decimals);
            transactionAmount = hsuiteAmount * multiplier;
            console.log(`Scaling transaction amount: ${hsuiteAmount} × 10^${details.decimals} = ${transactionAmount}`);
          } catch (error) {
            console.error('Error fetching token details:', error);
            // Use default scaling if we couldn't get token details
            transactionAmount = hsuiteAmount * 100000;
            console.log('Using default scaling factor, amount:', transactionAmount);
          }
        } else {
          // Already have decimals info, use it directly
          const multiplier = Math.pow(10, tokenDecimals);
          transactionAmount = hsuiteAmount * multiplier;
          console.log(`Using cached decimals: ${hsuiteAmount} × 10^${tokenDecimals} = ${transactionAmount}`);
        }
      } else {
        console.log(`Preparing transaction for non-HSUITE token: ${tokenId}`);
      }
      
      // Use the operator ID as the receiver
      const receiverAccountId = operatorId;
      
      console.log('Creating payment transaction with params:', {
        tokenId,
        amount: transactionAmount,
        sender: accountId,
        receiver: receiverAccountId
      });
      
      // Create the transaction
      const tx = await createPaymentTransaction(
        tokenId,
        transactionAmount,
        accountId,
        receiverAccountId
      );
      
      console.log('Transaction created successfully');
      setTransaction(tx);
      transactionPrepared.current = true;
    } catch (err: any) {
      console.error('Error creating transaction:', err);
      setError(err.message || 'Failed to create transaction');
      
      // Retry logic - only retry up to 3 times
      if (retryCount < 3) {
        console.log(`Retrying transaction creation (attempt ${retryCount + 1})`);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
        }, 1000); // Wait 1 second before retry
      }
    } finally {
      setIsCreatingTransaction(false);
    }
  };
  
  const handleConfirm = async () => {
    if (!transaction || isSubmitting.current) {
      return;
    }

    try {
      isSubmitting.current = true;
      setIsProcessing(true);
      setError(null);
      
      const signedTransaction = await signTransaction(transaction);

      // Convert transaction to base64 for sending to the backend
      const signedTransactionBytes = Buffer.from(signedTransaction.toBytes()).toString('base64');
      
      // Submit the signed transaction to execute the payment
      const response = await fetch(api('/api/hedera/processProjectPayment'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedTransactionBytes })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Payment execution failed');
      }

      const transactionId = result.data.transactionId;
      if (!transactionId) {
        throw new Error('No transaction ID returned from backend');
      }
      
      // Prepare subscription details
      const subscriptionDetails = {
        periodMonths: 1,
        projectLimit: 3,
        messageLimit: 100,
        priceUSD: subscriptionPriceUSD,
        priceHSuite: hsuiteAmount
      };
      
      // Get license topic ID
      const licenseResponse = await fetch(api(`/api/hedera/getUserLicense?accountId=${accountId}`));
      const licenseData = await licenseResponse.json();
      
      if (!licenseData.success || !licenseData.data?.topicId) {
        throw new Error('Failed to retrieve user license information');
      }
      
      // Submit subscription data
      const subscriptionResponse = await fetch(api('/api/subscription'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseTopicId: licenseData.data.topicId,
          paymentTransactionId: transactionId,
          subscription: subscriptionDetails
        })
      });
      
      const subscriptionResult = await subscriptionResponse.json();
      
      if (!subscriptionResult.success) {
        throw new Error(subscriptionResult.error || 'Failed to record subscription');
      }
      
      // Update UI state
      setSubscriptionDetails({
        subscriptionId: subscriptionResult.subscriptionId,
        expiresAt: subscriptionResult.expiresAt
      });

      setIsSuccess(true);
      setIsProcessing(false);
      
      // Store the transaction ID for later use
      setTransactionId(transactionId);
      
    } catch (err: any) {
      console.error('Error processing subscription:', err);
      setError(err.message || 'Failed to process subscription');
      setIsProcessing(false);
    } finally {
      isSubmitting.current = false;
    }
  };
  
  const handleClose = () => {
    if (isSuccess && transactionId) {
      onConfirm(transactionId);
    }
    onClose();
  };
  
  if (!isOpen || !modalRoot) return null;
  
  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
        </div>
        
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        
        <div 
          className="inline-block align-bottom rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full bg-gradient-to-b from-gray-900 to-black border border-indigo-500/20"
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="modal-headline"
        >
          {/* Top accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          
          <div className="px-6 pt-6 pb-4 sm:p-8">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-indigo-600 to-purple-700 sm:mx-0 sm:h-12 sm:w-12 shadow-lg shadow-indigo-500/30">
                <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 className="text-xl leading-6 font-bold text-white" id="modal-headline">
                  {isRenewal ? 'Renew Subscription' : 'Premium Subscription'}
                </h3>
                <p className="mt-1 text-sm text-gray-400">
                  {isRenewal ? 'Continue using the full power of SmartApp Studio' : 'Unlock the full potential of SmartApp Studio'}
                </p>
              </div>
            </div>
            
            <div className="mt-6">
              <div className="bg-gray-800/50 p-5 rounded-xl border border-white/5">
                <h4 className="text-md font-semibold text-white mb-4">Subscription Details</h4>
                <ul className="space-y-3 text-sm text-gray-300">
                  <li className="flex items-center justify-between">
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-indigo-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Duration:</span>
                    </div>
                    <span className="font-medium text-white">1 month</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-indigo-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span>Projects:</span>
                    </div>
                    <span className="font-medium text-white">Up to 3 projects</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-indigo-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      <span>Messages:</span>
                    </div>
                    <span className="font-medium text-white">100 per month</span>
                  </li>
                  <li className="pt-3 mt-2 border-t border-gray-700/50 flex justify-between">
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-indigo-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">Price:</span>
                    </div>
                    <span className="font-medium text-white">${subscriptionPriceUSD}.00 USD</span>
                  </li>
                  <li className="flex justify-between">
                    <div className="flex items-center">
                      <svg className="h-5 w-5 text-indigo-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="font-medium">HSuite:</span>
                    </div>
                    <span className="font-medium text-indigo-300">{displayAmount}</span>
                  </li>
                </ul>
                
                <div className="mt-5 pt-4 border-t border-gray-700/50">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-gray-400">
                      <svg className="h-4 w-4 text-green-500 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span>Secure blockchain payment</span>
                    </div>
                    <span className="text-indigo-300">Hedera network</span>
                  </div>
                </div>
              </div>
              
              {/* Renewal banner - only show when in renewal mode */}
              {isRenewal && !isSuccess && (
                <div className="mt-4 p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                  <div className="flex">
                    <svg className="h-5 w-5 text-amber-400 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3c4.845 0 9 3.85 9 8.5 0 4.912-4.486 8.713-9.5 8.5-5.018-.214-8.5-3.699-8.5-8.5C3 6.85 7.155 3 12 3z" />
                    </svg>
                    <div>
                      <p className="text-sm text-amber-300 font-medium">Your subscription has expired</p>
                      <p className="text-xs text-amber-200/70 mt-1">Renew now to continue using all your projects and create new ones.</p>
                    </div>
                  </div>
                </div>
              )}
              
              {error && (
                <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <div className="flex">
                    <svg className="h-5 w-5 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                </div>
              )}

              {isSuccess && subscriptionDetails && (
                <div className="mt-4 p-6 bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-xl animate-fade-in">
                  <div className="flex flex-col space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
                        <div className="relative flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full shadow-lg shadow-green-500/30">
                          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-green-300">
                          {isRenewal ? 'Subscription Renewed!' : 'Subscription Activated!'}
                        </h4>
                        <p className="text-sm text-green-400">
                          {isRenewal ? 'Your premium access has been extended' : 'Your premium access has been confirmed'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2 pl-15">
                      <div className="flex items-center space-x-2 text-sm">
                        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                        </svg>
                        <span className="text-green-300">ID: <span className="font-mono text-green-400">{subscriptionDetails.subscriptionId}</span></span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-green-300">Expires: <span className="text-green-400">{new Date(subscriptionDetails.expiresAt).toLocaleDateString()}</span></span>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-green-500/20">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-green-400">Thank you for your subscription!</span>
                        <div className="flex items-center space-x-1">
                          <span className="text-green-300">Powered by</span>
                          <span className="text-green-400 font-medium">Hedera</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="px-6 py-4 bg-black/40 sm:px-8 sm:flex sm:flex-row-reverse">
            {!isSuccess ? (
              <>
                <button
                  type="button"
                  className={`w-full sm:w-auto inline-flex justify-center rounded-lg px-6 py-2.5 ${
                    transaction 
                      ? isRenewal 
                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-lg shadow-amber-500/30'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/30' 
                      : 'bg-gray-700'
                  } text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 ${
                    isProcessing || !transaction || isCreatingTransaction || isLoadingOperatorId
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'transform transition-transform hover:-translate-y-0.5'
                  }`}
                  onClick={handleConfirm}
                  disabled={isProcessing || !transaction || isCreatingTransaction || isLoadingOperatorId}
                >
                  {isProcessing ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : isCreatingTransaction ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Preparing...
                    </span>
                  ) : isLoadingOperatorId ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Initializing...
                    </span>
                  ) : (
                    isRenewal ? 'Renew Now' : 'Confirm Payment'
                  )}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full sm:w-auto sm:mt-0 inline-flex justify-center rounded-lg border border-gray-600 shadow-sm px-6 py-2.5 bg-gray-800 text-sm font-medium text-gray-300 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transform transition-transform hover:-translate-y-0.5"
                  onClick={onClose}
                  disabled={isProcessing}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className={`w-full sm:w-auto inline-flex justify-center rounded-lg px-6 py-2.5 ${
                  isRenewal 
                    ? 'bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 shadow-lg shadow-amber-500/30'
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/30'
                } text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transform transition-transform hover:-translate-y-0.5`}
                onClick={handleClose}
              >
                <span className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Close & Continue
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, modalRoot);
};

export default SubscriptionModal; 