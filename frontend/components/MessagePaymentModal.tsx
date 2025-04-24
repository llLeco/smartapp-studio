import React, { useEffect, useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { Transaction } from '@hashgraph/sdk';
import { createMessagePaymentTransaction, getTokenDetails } from '../services/licenseService';

// Configurar URL base do backend
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const api = (path: string) => `${BACKEND_URL}${path.startsWith('/') ? path : '/' + path}`;

// Token ID do HSUITE
const HSUITE_TOKEN_ID = process.env.NEXT_PUBLIC_HSUITE_TOKEN_ID || '0.0.2203022';

interface MessagePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (transactionId: string, messageCount: number) => void;
  tokenId: string;
  receiverAccountId: string;
  messageCount?: number; // This is now optional
}

const MessagePaymentModal: React.FC<MessagePaymentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  tokenId,
  receiverAccountId,
  messageCount: initialMessageCount = 5 // Default to 5 if not provided
}) => {
  const [step, setStep] = useState<1 | 2>(1); // 1: Select quantity, 2: Payment confirmation
  const [messageCount, setMessageCount] = useState<number>(initialMessageCount);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingTransaction, setIsCreatingTransaction] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
  const [isLoadingTokenDetails, setIsLoadingTokenDetails] = useState(false);
  const { accountId, signTransaction } = useWallet();
  
  // Message price from environment variable
  const pricePerMessage = parseInt(process.env.NEXT_PUBLIC_MESSAGE_PRICE || "1000", 10);
  const totalPrice = messageCount * pricePerMessage;
  
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
    // Reset step when modal opens
    if (isOpen) {
      // If messageCount is provided, go directly to step 2
      setStep(initialMessageCount !== 5 ? 2 : 1);
      setMessageCount(initialMessageCount);
    }
  }, [isOpen, initialMessageCount]);
  
  useEffect(() => {
    // When the payment step is shown and we have an accountId, create the transaction
    if (isOpen && step === 2 && accountId && !transaction && !isCreatingTransaction) {
      prepareTransaction();
    }
  }, [isOpen, step, accountId, transaction, isCreatingTransaction]);
  
  const prepareTransaction = async () => {
    if (!accountId) {
      setError('Carteira não conectada');
      return;
    }
    
    try {
      setIsCreatingTransaction(true);
      setError(null);
      
      // Pass the raw amount without scaling for decimals
      // The createMessagePaymentTransaction function will handle the decimals multiplication
      const tx = await createMessagePaymentTransaction(
        tokenId,
        messageCount,
        accountId,
        receiverAccountId
      );
      
      setTransaction(tx);
      
      // Log that we're using the service's decimal handling
      console.log(`Using licenseService for decimal scaling: messageCount=${messageCount}`);
    } catch (err: any) {
      console.error('Error creating transaction:', err);
      setError(err.message || 'Falha ao criar transação');
    } finally {
      setIsCreatingTransaction(false);
    }
  };
  
  const handleConfirm = async () => {
    if (!transaction) {
      setError('Transação não disponível');
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
      const response = await fetch(api('/api/hedera/processProjectPayment'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedTransactionBytes })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Pagamento falhou');
      }
      
      // Call the onConfirm callback with the transaction ID
      onConfirm(result.data.transactionId || 'completed', messageCount);
      
    } catch (err: any) {
      console.error('Error processing payment:', err);
      setError(err.message || 'Falha ao processar pagamento');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleSelectMessageCount = () => {
    setStep(2);
    // Reset transaction when message count changes
    setTransaction(null);
  };
  
  if (!isOpen) return null;
  
  const displayAmount = getDisplayAmount();
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-black opacity-75"></div>
        </div>
        
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        
        <div 
          className="inline-block align-bottom bg-gray-900 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="modal-headline"
        >
          {step === 1 ? (
            // Step 1: Message Quantity Selection
            <>
              <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-white" id="modal-headline">
                      Comprar Mensagens Adicionais
                    </h3>
                    
                    <div className="mt-4">
                      <div className="mb-6">
                        <label htmlFor="messageCount" className="block text-sm font-medium text-gray-300 mb-2">
                          Quantidade de Mensagens: <span className="font-semibold text-blue-400">{messageCount}</span>
                        </label>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-400">5</span>
                          <input
                            type="range"
                            name="messageCount"
                            id="messageCount"
                            min="5"
                            max="50"
                            step="5"
                            value={messageCount}
                            onChange={(e) => setMessageCount(parseInt(e.target.value, 10))}
                            className="flex-1 rounded-md bg-gray-700 appearance-none h-2 focus:outline-none accent-blue-500"
                          />
                          <span className="text-sm text-gray-400">50</span>
                        </div>
                      </div>
                      
                      <div className="bg-gray-800 p-4 rounded-md mb-4">
                        <h4 className="text-sm font-medium text-white mb-2">Informações sobre a compra:</h4>
                        
                        <ul className="text-sm text-gray-300 space-y-2">
                          <li className="flex items-start">
                            <svg className="h-5 w-5 text-green-400 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Custo por Mensagem: <span className="text-green-400 font-medium">{pricePerMessage} Hsuites</span></span>
                          </li>
                          <li className="flex items-start">
                            <svg className="h-5 w-5 text-green-400 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Quantidade de Mensagens: <span className="text-blue-400 font-medium">{messageCount}</span></span>
                          </li>
                          <li className="flex items-start font-medium">
                            <svg className="h-5 w-5 text-green-400 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Total: <span className="text-green-400 font-medium">{messageCount * pricePerMessage} Hsuites</span></span>
                          </li>
                        </ul>
                        
                        <p className="text-xs text-gray-400 mt-3">
                          Após confirmar, você será solicitado a aprovar a transação usando sua carteira.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleSelectMessageCount}
                >
                  Confirmar Quantidade
                </button>
                
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-500 shadow-sm px-4 py-2 bg-gray-700 text-base font-medium text-gray-200 hover:bg-gray-600 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={onClose}
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            // Step 2: Payment Confirmation
            <>
              <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-white" id="modal-headline">
                      Confirmar Pagamento
                    </h3>
                    
                    <div className="mt-4">
                      <div className="bg-gray-800 p-4 rounded-md mb-4">
                        <p className="text-sm text-gray-300 mb-2">
                          Compra de mensagens adicionais:
                        </p>
                        <p className="text-lg font-medium text-white mb-4">
                          {messageCount} mensagens
                        </p>
                        
                        <p className="text-sm text-gray-300 mb-2">
                          Custo por mensagem: <span className="text-green-400 font-medium">{pricePerMessage} Hsuites</span>
                        </p>
                        
                        <p className="text-sm text-gray-300 mb-2">
                          Custo total:
                        </p>
                        <p className="text-lg font-medium text-green-400">
                          {totalPrice} Hsuites
                        </p>
                      </div>
                      
                      {isLoadingTokenDetails && (
                        <div className="bg-blue-900/30 border border-blue-700 text-blue-200 p-3 rounded-md mb-4 flex items-center">
                          <svg className="animate-spin mr-2 h-4 w-4 text-blue-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Carregando detalhes do token...
                        </div>
                      )}
                      
                      {isCreatingTransaction && (
                        <div className="bg-blue-900/30 border border-blue-700 text-blue-200 p-3 rounded-md mb-4 flex items-center">
                          <svg className="animate-spin mr-2 h-4 w-4 text-blue-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Preparando transação...
                        </div>
                      )}
                      
                      {error && (
                        <div className="bg-red-900/50 border border-red-700 text-red-200 p-3 rounded-md mb-4">
                          {error}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  disabled={isProcessing || isCreatingTransaction || isLoadingTokenDetails || !transaction}
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:ml-3 sm:w-auto sm:text-sm ${
                    isProcessing || isCreatingTransaction || isLoadingTokenDetails || !transaction 
                      ? 'bg-blue-400 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  onClick={handleConfirm}
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processando...
                    </>
                  ) : 'Confirmar Pagamento'}
                </button>
                
                <button
                  type="button"
                  disabled={isProcessing}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-500 shadow-sm px-4 py-2 bg-gray-700 text-base font-medium text-gray-200 hover:bg-gray-600 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => step === 2 ? setStep(1) : onClose()}
                >
                  {step === 2 ? 'Voltar' : 'Cancelar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagePaymentModal; 