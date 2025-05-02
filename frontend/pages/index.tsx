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
        <title>SmartApp Studio - Build Decentralized Apps Without Smart Contracts</title>
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
                        Build Decentralized Apps Without Smart Contracts
                      </h1>
                      <p className="text-xl max-w-3xl mx-auto text-gray-300 mb-8">
                        SmartApp Studio uses AI and SmartNodes to generate validators and config files that power your decentralized applications on Hedera — no smart contract coding required.
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
                      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6">The Problem</h2>
                      <p className="text-lg text-gray-300 text-center mb-10">
                        Building decentralized applications requires deep blockchain expertise, complex smart contract development, and significant security considerations, creating a high barrier to entry for many developers.
                      </p>
                      
                      <div className="grid md:grid-cols-2 gap-6 mt-8">
                        <div className="bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10">
                          <h3 className="text-lg font-bold text-white mb-3">Smart Contract Complexity</h3>
                          <p className="text-gray-300">
                            Writing secure smart contracts requires specialized knowledge and introduces risks of expensive bugs and vulnerabilities.
                          </p>
                        </div>
                        
                        <div className="bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10">
                          <h3 className="text-lg font-bold text-white mb-3">Development Time & Cost</h3>
                          <p className="text-gray-300">
                            Blockchain development often requires longer development cycles and specialized teams, increasing costs for businesses.
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Solution Section */}
                  <section className="px-8 py-12 border-b border-white/10">
                    <div className="max-w-4xl mx-auto">
                      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6">Our Solution</h2>
                      <p className="text-lg text-gray-300 text-center mb-10">
                        SmartApp Studio combines the power of AI with off-chain SmartNodes to simplify decentralized application development on the Hedera network.
                      </p>
                      
                      <div className="bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10 mb-8">
                        <div className="flex flex-col md:flex-row items-center gap-6">
                          <div className="md:w-1/2">
                            <h3 className="text-xl font-bold text-white mb-4">SmartNodes Instead of Smart Contracts</h3>
                            <p className="text-gray-300">
                              Replace complex smart contract code with simple JSON configurations that define your application logic. Our off-chain validators from HbarSuite execute your logic while maintaining decentralization and security.
                            </p>
                          </div>
                          <div className="md:w-1/2">
                            <h3 className="text-xl font-bold text-white mb-4">AI-Powered Development</h3>
                            <p className="text-gray-300">
                              Our AI assistant is trained specifically on SmartApp code and patterns, helping you generate complete validators and configuration files with simple prompts — enabling you to flow through your app development.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Features Section */}
                  <section id="features" className="px-8 py-12 border-b border-white/10">
                    <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">Core Features</h2>
                    
                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="flex-shrink-0 h-10 w-10 bg-blue-700 rounded-full flex items-center justify-center">
                            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-bold text-white">AI-Powered Generation</h3>
                        </div>
                        <p className="text-gray-300">
                          Generate complete validator logic and configuration files with our specialized AI assistant trained on decentralized application patterns.
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
                          Dynamic NFTs serve as your identity and access credentials, providing secure, token-gated access to applications and features.
                        </p>
                      </div>
                      
                      <div className="bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="flex-shrink-0 h-10 w-10 bg-purple-700 rounded-full flex items-center justify-center">
                            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-bold text-white">HCS-10 Event Logging</h3>
                        </div>
                        <p className="text-gray-300">
                          All events and access are securely logged to Hedera via HCS-10 topics, providing immutable audit trails for your applications.
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
                          <h3 className="text-lg font-bold text-white">HSuite Token Subscriptions</h3>
                        </div>
                        <p className="text-gray-300">
                          Subscribe to plans using HSuite tokens, with new users receiving free tokens to get started immediately.
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
                          Securely connect your Hedera wallet with built-in WalletConnect 2.0 integration for a seamless user experience.
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
                        <p className="text-gray-400 text-sm">Get HSuite tokens and subscribe to a plan</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="text-xl font-bold">3</span>
                        </div>
                        <h3 className="text-lg font-medium mb-2">Define & Generate</h3>
                        <p className="text-gray-400 text-sm">Use AI to generate validators and config files</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="text-xl font-bold">4</span>
                        </div>
                        <h3 className="text-lg font-medium mb-2">Deploy & Go Live</h3>
                        <p className="text-gray-400 text-sm">Deploy validators and flow your app development</p>
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
                              <h3 className="text-lg font-bold text-white">Current MVP</h3>
                              <p className="text-gray-400 mt-2">Live on testnet with core features</p>
                            </div>
                            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center z-10">
                              <span className="text-sm font-bold">✓</span>
                            </div>
                            <div className="flex-1 pl-8 md:pl-12">
                              <ul className="list-disc text-gray-300 ml-4">
                                <li>AI SmartApp generation</li>
                                <li>NFT licensing system</li>
                                <li>HCS-10 event logging</li>
                                <li>Token-based subscriptions</li>
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
                                <li>Pre-built validator templates</li>
                                <li>One-click GitHub deployment</li>
                                <li>SmartNode deployment wizard</li>
                                <li>Advanced AI customization</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                        
                        <div className="relative z-10">
                          <div className="flex items-center">
                            <div className="flex-1 text-right pr-8 md:pr-12">
                              <h3 className="text-lg font-bold text-white">Future Vision</h3>
                              <p className="text-gray-400 mt-2">Expanding the ecosystem</p>
                            </div>
                            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center z-10">
                              <span className="text-sm font-bold">→</span>
                            </div>
                            <div className="flex-1 pl-8 md:pl-12">
                              <ul className="list-disc text-gray-300 ml-4">
                                <li>Enterprise SmartApp solutions</li>
                                <li>Marketplace for SmartApp templates</li>
                                <li>SDK for custom integrations</li>
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
                      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">Get Started Today</h2>
                      <p className="text-lg text-gray-300 text-center mb-8">
                        Connect your wallet, mint your NFT license, and start building with ready-to-use validators and config files to power your decentralized applications.
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