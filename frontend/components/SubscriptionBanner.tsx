import React, { useState } from 'react';
import SubscriptionModal from './SubscriptionModal';

interface SubscriptionInfo {
  active: boolean;
  expiresAt: string;
  projectLimit: number;
  messageLimit: number;
  projectsUsed: number;
  messagesUsed: number;
  tokenId?: string;
  receiverAccountId?: string;
  buttonText?: string;
}

interface SubscriptionBannerProps {
  subscription: SubscriptionInfo | null;
  license: any;
  loading: boolean;
  onPurchase: (tokenId?: string, receiverAccountId?: string) => void;
  isProcessing: boolean;
}

// Default token ID and receiver account ID
//TODO: replace this 
const DEFAULT_TOKEN_ID = process.env.NEXT_PUBLIC_HSUITE_TOKEN_ID || '0.0.2203022';
const DEFAULT_RECEIVER_ID = process.env.NEXT_PUBLIC_RECEIVER_ACCOUNT_ID || '0.0.1234567';

const SubscriptionBanner: React.FC<SubscriptionBannerProps> = ({
  subscription,
  loading,
  onPurchase,
  isProcessing
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [receiverAccountId, setReceiverAccountId] = useState<string | null>(null);
  
  const handleOpenModal = (tokenId: string, receiverId: string) => {
    setSelectedTokenId(tokenId);
    setReceiverAccountId(receiverId);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleConfirmPayment = () => {
    if (selectedTokenId && receiverAccountId && onPurchase) {
      onPurchase(selectedTokenId, receiverAccountId);
      setIsModalOpen(false);
    }
  };

  return (
    <div className="relative overflow-hidden p-8 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10 shadow text-white">
      <div>
        <div className="flex items-center space-x-3 mb-4">
          <div className="flex-shrink-0 h-12 w-12 bg-indigo-700 rounded-full flex items-center justify-center">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white">SmartApp Studio Subscription</h2>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl font-medium text-white mb-4">Unlimited Possibilities</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <svg className="h-5 w-5 text-indigo-400 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-200">Create up to <span className="font-bold text-white">3 projects</span> simultaneously</span>
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-indigo-400 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-200">Exchange up to <span className="font-bold text-white">100 messages</span> per month</span>
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-indigo-400 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-200">Access to <span className="font-bold text-white">premium AI models</span> and capabilities</span>
              </li>
              <li className="flex items-start">
                <svg className="h-5 w-5 text-indigo-400 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-200"><span className="font-bold text-white">Securely stored</span> on Hedera blockchain</span>
              </li>
            </ul>
          </div>
          
          <div className="bg-black/20 rounded-lg p-6 border border-white/10">
            {loading ? (
              <div className="py-8 flex justify-center items-center">
                <div className="animate-pulse flex space-x-2">
                  <div className="h-3 w-3 bg-blue-400 rounded-full"></div>
                  <div className="h-3 w-3 bg-blue-400 rounded-full"></div>
                  <div className="h-3 w-3 bg-blue-400 rounded-full"></div>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold text-white mb-2">Unlock Premium Access</h3>
                  <p className="text-gray-300 mb-4">Experience the full power of SmartApp Studio with our monthly subscription</p>
                  <div className="flex items-baseline justify-center">
                    <span className="text-3xl font-extrabold text-white">$20</span>
                    <span className="ml-1 text-xl text-gray-400">/month</span>
                  </div>
                </div>
                
                <div className="mt-8">
                  <button
                    onClick={() => {
                      // Use token and receiver from subscription or fallback to defaults
                      const tokenId = subscription?.tokenId || DEFAULT_TOKEN_ID;
                      const receiverId = subscription?.receiverAccountId || DEFAULT_RECEIVER_ID;
                      handleOpenModal(tokenId, receiverId);
                    }}
                    disabled={isProcessing}
                    className="w-full px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium shadow-lg hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <div className="flex items-center justify-center">
                        <div className="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin mr-2"></div>
                        Processing...
                      </div>
                    ) : (
                      subscription?.buttonText || "Subscribe Now"
                    )}
                  </button>
                </div>
                
                <p className="mt-3 text-xs text-center text-gray-400">
                  Secure payment via Hedera blockchain using HSuite tokens
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Subscription Modal */}
      {isModalOpen && selectedTokenId && receiverAccountId && (
        <SubscriptionModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onConfirm={handleConfirmPayment}
          paymentData={{
            tokenId: selectedTokenId,
            receiverAccountId: receiverAccountId
          }}
          license={subscription}
        />
      )}
    </div>
  );
};

export default SubscriptionBanner;