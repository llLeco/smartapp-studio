import { useRouter } from 'next/router';
import Head from 'next/head';
import { useWallet } from '../hooks/useWallet';
import BottomNavBar from '../components/BottomNavBar';
import Link from 'next/link';
import SubscriptionBanner from '../components/SubscriptionBanner';
import { useState, useEffect } from 'react';
import SubscriptionModal from '../components/SubscriptionModal';
import { getUserLicense } from '../services/licenseService';

export default function Home() {
  const router = useRouter();
  const { isConnected } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [tokenId] = useState(process.env.NEXT_PUBLIC_HSUITE_TOKEN_ID || '0.0.2203022');
  const [receiverAccountId, setReceiverAccountId] = useState<string | null>(null);
  
  // Fetch operator ID when component mounts
  useEffect(() => {
    const fetchOperatorId = async () => {
      try {
        console.log('Fetching operator ID...');
        const networkRes = await fetch('/api/hedera?type=network');
        const networkData = await networkRes.json();

        if (!networkData.success || !networkData.operatorId) {
          throw new Error('Operator ID not available');
        }
        
        let operatorId = networkData.operatorId;
        
        if (networkData.success && operatorId) {
          setReceiverAccountId(operatorId);
          console.log('Operator ID obtained: ', operatorId);
        } else {
          console.error('Failed to get Operator ID:', operatorId);
          setReceiverAccountId('0.0.1234567');
        }
      } catch (error) {
        console.error('Error fetching Operator ID:', error);
        setReceiverAccountId('0.0.1234567');
      }
    };
    
    fetchOperatorId();
  }, []);

  const handlePurchase = () => {
    console.log('Purchase button clicked!');
    setIsProcessing(true);
    
    // Make sure we have a receiver ID (use fallback if API failed)
    if (!receiverAccountId) {
      console.log('No receiver ID, using fallback');
      setReceiverAccountId('0.0.1234567');
    }
    
    // Open subscription modal
    console.log('Opening subscription modal...');
    setShowSubscriptionModal(true);
  };

  // Handle payment confirmation
  const handlePaymentConfirm = async (transactionId: string) => {
    try {
      console.log(`Payment confirmed: ${transactionId}`);
      // Close the modal
      setShowSubscriptionModal(false);
      setIsProcessing(false);
      
      // Show success message or redirect to app
      alert(`Subscription successful! Your premium features are now active.`);
      if (isConnected) {
        router.push('/app');
      }
    } catch (error: any) {
      console.error('Error processing subscription:', error);
      alert(`Error processing subscription: ${error.message || 'Unknown error'}`);
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Head>
        <title>SmartApp Studio - Build Web3 Apps Without Smart Contracts</title>
        <meta name="description" content="SmartApp Studio - Create decentralized applications on Hedera without writing smart contracts, powered by AI and SmartNodes" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex h-screen overflow-hidden text-white">
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto scrollbar-custom relative">
            <div className="max-w-6xl mx-auto px-4 py-8">
              {/* Main App-like Container with macOS window styling */}
              <div className="rounded-xl border border-white/10 bg-black/30 backdrop-blur-md shadow-xl overflow-hidden">
                {/* macOS-style window header */}
                <div className="px-4 py-3 border-b border-white/10 flex items-center">
                  <div className="flex space-x-2 mr-4">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <div className="flex-1 text-center text-sm font-medium text-gray-400">SmartApp Studio</div>
                </div>

                {/* Content Area */}
                <div className="overflow-y-auto max-h-[calc(100vh-10rem)]">
                  {/* Hero Section */}
                  <div className="relative overflow-hidden px-8 py-12 border-b border-white/10">
                    <div className="relative z-10 text-center">
                      <h1 className="text-4xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600 mb-6">
                        Build Web3 Apps — Without Touching a Smart Contract
                      </h1>
                      <p className="text-xl max-w-3xl mx-auto text-gray-300 mb-8">
                        Welcome to SmartApp Studio — the easiest way to create decentralized applications on Hedera. No need to learn Solidity. Just describe what you want and let our AI + SmartNodes handle the rest.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        {isConnected ? (
                          <Link href="/app">
                            <span className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-md font-medium shadow-sm transition inline-block">
                              My Projects
                            </span>
                          </Link>
                        ) : (
                          <Link href="/get-access">
                            <span className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-md font-medium shadow-sm transition inline-block">
                              Get Started
                            </span>
                          </Link>
                        )}
                        <a 
                          href="#problem" 
                          className="px-6 py-3 border border-white/20 hover:bg-white/10 rounded-md font-medium transition"
                        >
                          Learn More
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Problem Section */}
                  <section id="problem" className="px-8 py-12 border-b border-white/10">
                    <div className="max-w-4xl mx-auto">
                      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6">Let's face it — building on blockchain is hard</h2>
                      <p className="text-lg text-gray-300 text-center mb-10">
                        Between smart contracts, gas fees, and security risks, most developers hit a wall before shipping anything meaningful in Web3.
                      </p>
                      
                      <div className="grid md:grid-cols-2 gap-6 mt-8">
                        <div className="bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10">
                          <h3 className="text-lg font-bold text-white mb-3">Smart Contracts Are Complicated</h3>
                          <p className="text-gray-300">
                            One small mistake in a smart contract can cost thousands of dollars. Plus, you need specialized knowledge just to get started.
                          </p>
                        </div>
                        
                        <div className="bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10">
                          <h3 className="text-lg font-bold text-white mb-3">Web3 Development Takes Forever</h3>
                          <p className="text-gray-300">
                            Traditional Web3 development means longer cycles, specialized teams, and higher costs — making it impractical for many cool ideas.
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Solution Section */}
                  <section className="px-8 py-12 border-b border-white/10">
                    <div className="max-w-4xl mx-auto">
                      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6">SmartApp Studio makes Web3 simple</h2>
                      <p className="text-lg text-gray-300 text-center mb-10">
                        We combine AI-powered code generation with off-chain SmartNodes so you can build real decentralized apps — without writing a single smart contract.
                      </p>
                      
                      <div className="bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10 mb-8">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                          <div className="md:w-1/2">
                            <h3 className="text-xl font-bold text-white mb-4">JSON Config Files Instead of Solidity</h3>
                            <p className="text-gray-300">
                              Replace complex smart contract code with simple JSON configurations. Our SmartNodes handle the heavy lifting while keeping your app secure and decentralized.
                            </p>
                          </div>
                          <div className="md:w-1/2">
                            <h3 className="text-xl font-bold text-white mb-4">Your Personal Web3 AI Assistant</h3>
                            <p className="text-gray-300">
                              Just describe what you want to build, and our AI will generate the code and config files for you. It's specifically trained on Web3 patterns to make your life easier.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Features Section */}
                  <section id="features" className="px-8 py-12 border-b border-white/10">
                    <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">What You Get</h2>
                    
                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="flex-shrink-0 h-10 w-10 bg-blue-700 rounded-full flex items-center justify-center">
                            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-bold text-white">AI Assistant</h3>
                        </div>
                        <p className="text-gray-300">
                          Chat with a custom-trained AI that builds SmartApp code and validator logic for you. Just describe what you want, and it delivers.
                        </p>
                      </div>
                      
                      <div className="bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="flex-shrink-0 h-10 w-10 bg-indigo-700 rounded-full flex items-center justify-center">
                            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-bold text-white">Token-Gated Access</h3>
                        </div>
                        <p className="text-gray-300">
                          Dynamic NFTs act as your ID and grant access to your apps and features — perfect for membership sites and premium content.
                        </p>
                      </div>
                      
                      <div className="bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="flex-shrink-0 h-10 w-10 bg-purple-700 rounded-full flex items-center justify-center">
                            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-bold text-white">On-Chain Logs</h3>
                        </div>
                        <p className="text-gray-300">
                          Everything is tracked on Hedera using HCS-10 — giving you perfect transparency and audit trails without the complexity.
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 mt-6">
                      <div className="bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="flex-shrink-0 h-10 w-10 bg-green-700 rounded-full flex items-center justify-center">
                            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-bold text-white">Subscription System</h3>
                        </div>
                        <p className="text-gray-300">
                          Users pay with HSuite tokens (you get test tokens to start). All licenses and features are tied to your NFT, making transactions seamless.
                        </p>
                      </div>
                      
                      <div className="bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="flex-shrink-0 h-10 w-10 bg-red-700 rounded-full flex items-center justify-center">
                            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-bold text-white">WalletConnect 2.0</h3>
                        </div>
                        <p className="text-gray-300">
                          Smooth, secure wallet connection built right in — no need to figure out complicated Web3 authentication flows.
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* How It Works Section */}
                  <section className="px-8 py-12 border-b border-white/10">
                    <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">How It Works</h2>
                    
                    <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="text-xl font-bold">1</span>
                        </div>
                        <h3 className="text-lg font-medium mb-2">Connect Wallet</h3>
                        <p className="text-gray-400 text-sm">Connect your Hedera wallet and mint your NFT license</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="text-xl font-bold">2</span>
                        </div>
                        <h3 className="text-lg font-medium mb-2">Subscribe</h3>
                        <p className="text-gray-400 text-sm">Get test HSuite tokens and subscribe to start building</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="text-xl font-bold">3</span>
                        </div>
                        <h3 className="text-lg font-medium mb-2">Chat with AI</h3>
                        <p className="text-gray-400 text-sm">Describe your idea and get complete app structure</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="text-xl font-bold">4</span>
                        </div>
                        <h3 className="text-lg font-medium mb-2">Deploy & Go Live</h3>
                        <p className="text-gray-400 text-sm">Start using your decentralized app right away</p>
                      </div>
                    </div>
                  </section>

                  {/* Roadmap Section */}
                  <section className="px-8 py-12 border-b border-white/10">
                    <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">Roadmap</h2>
                    
                    <div className="max-w-4xl mx-auto">
                      <div className="relative">
                        <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-indigo-600/30"></div>
                        
                        <div className="relative z-10 mb-12">
                          <div className="flex items-center">
                            <div className="flex-1 text-right pr-8 md:pr-12">
                              <h3 className="text-lg font-bold text-white">Today (Live on Testnet)</h3>
                              <p className="text-gray-400 mt-2">Already working and ready to try</p>
                            </div>
                            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center z-10">
                              <span className="text-sm font-bold">✓</span>
                            </div>
                            <div className="flex-1 pl-8 md:pl-12">
                              <ul className="list-disc text-gray-300 ml-4">
                                <li>SmartApp code generation with AI</li>
                                <li>NFT licensing + token subscriptions</li>
                                <li>Hedera logging via HCS-10</li>
                                <li>WalletConnect 2.0 integration</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                        
                        <div className="relative z-10 mb-12">
                          <div className="flex items-center">
                            <div className="flex-1 text-right pr-8 md:pr-12">
                              <h3 className="text-lg font-bold text-white">Coming Soon</h3>
                              <p className="text-gray-400 mt-2">Full mainnet launch</p>
                            </div>
                            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center z-10">
                              <span className="text-sm font-bold">→</span>
                            </div>
                            <div className="flex-1 pl-8 md:pl-12">
                              <ul className="list-disc text-gray-300 ml-4">
                                <li>One-click GitHub deployment</li>
                                <li>Prebuilt app templates</li>
                                <li>SmartNode deployment wizard</li>
                                <li>Custom AI tuning for dev teams</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                        
                        <div className="relative z-10">
                          <div className="flex items-center">
                            <div className="flex-1 text-right pr-8 md:pr-12">
                              <h3 className="text-lg font-bold text-white">The Vision</h3>
                              <p className="text-gray-400 mt-2">Expanding the ecosystem</p>
                            </div>
                            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center z-10">
                              <span className="text-sm font-bold">→</span>
                            </div>
                            <div className="flex-1 pl-8 md:pl-12">
                              <ul className="list-disc text-gray-300 ml-4">
                                <li>Enterprise SmartApp solutions</li>
                                <li>SmartApp template marketplace</li>
                                <li>SDKs for custom integrations</li>
                                <li>Advanced analytics dashboard</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Premium Section - Using SubscriptionBanner */}
                  <section className="px-8 py-12 border-b border-white/10">
                    <div className="max-w-4xl mx-auto">
                      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">Ready to Try?</h2>
                      <p className="text-lg text-gray-300 text-center mb-8">
                        Connect your wallet, mint your license, and start building your next Web3 app with tools that work for you — not just for devs with smart contract experience.
                      </p>
                      <SubscriptionBanner
                        subscription={null}
                        license={null}
                        loading={false}
                        onPurchase={handlePurchase}
                        onConfirm={() => {router.push('/app')}}
                        isProcessing={isProcessing}
                      />
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => {
          console.log('Closing subscription modal');
          setShowSubscriptionModal(false);
          setIsProcessing(false);
        }}
        onConfirm={handlePaymentConfirm}
      />

      <BottomNavBar />
    </>
  );
} 