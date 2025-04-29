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
        <title>SmartApp Studio - Build Smart Apps With AI</title>
        <meta name="description" content="SmartApp Studio - Create intelligent applications powered by AI, blockchain, and smart contracts" />
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
                        Build Intelligent Apps Faster
                      </h1>
                      <p className="text-xl max-w-3xl mx-auto text-gray-300 mb-8">
                        SmartApp Studio helps developers create powerful AI-driven applications with a seamless integration of blockchain technology.
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
                          href="#features" 
                          className="px-6 py-3 border border-white/20 hover:bg-white/10 rounded-md font-medium transition"
                        >
                          Learn More
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Features Section */}
                  <section id="features" className="px-8 py-12 border-b border-white/10">
                    <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">Why SmartApp Studio?</h2>
                    
                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="flex-shrink-0 h-10 w-10 bg-blue-700 rounded-full flex items-center justify-center">
                            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-bold text-white">AI-Powered Development</h3>
                        </div>
                        <p className="text-gray-300">
                          Leverage advanced AI models to generate code, design interfaces, and build complex features with simple text prompts.
                        </p>
                      </div>
                      
                      <div className="bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="flex-shrink-0 h-10 w-10 bg-indigo-700 rounded-full flex items-center justify-center">
                            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-bold text-white">Blockchain Integration</h3>
                        </div>
                        <p className="text-gray-300">
                          Seamlessly integrate Hedera blockchain technology for secure storage, smart contracts, and decentralized applications.
                        </p>
                      </div>
                      
                      <div className="bg-white/5 rounded-lg p-6 backdrop-blur-sm border border-white/10">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="flex-shrink-0 h-10 w-10 bg-purple-700 rounded-full flex items-center justify-center">
                            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-bold text-white">Enterprise Security</h3>
                        </div>
                        <p className="text-gray-300">
                          Build with confidence knowing your data and code are protected by enterprise-grade security and blockchain technology.
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
                        <p className="text-gray-400 text-sm">Connect your Hedera wallet</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="text-xl font-bold">2</span>
                        </div>
                        <h3 className="text-lg font-medium mb-2">Create Project</h3>
                        <p className="text-gray-400 text-sm">Define your app specifications</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="text-xl font-bold">3</span>
                        </div>
                        <h3 className="text-lg font-medium mb-2">AI Generation</h3>
                        <p className="text-gray-400 text-sm">Let AI build your application</p>
                      </div>
                      
                      <div className="text-center">
                        <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="text-xl font-bold">4</span>
                        </div>
                        <h3 className="text-lg font-medium mb-2">Deploy & Scale</h3>
                        <p className="text-gray-400 text-sm">Launch with blockchain integration</p>
                      </div>
                    </div>
                  </section>

                  {/* Premium Section - Using SubscriptionBanner */}
                  <section className="px-8 py-12 border-b border-white/10">
                    <div className="max-w-4xl mx-auto">
                      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">Unlock Premium Features</h2>
                      <SubscriptionBanner
                        subscription={null}
                        license={null}
                        loading={false}
                        onPurchase={handlePurchase}
                        isProcessing={isProcessing}
                      />
                    </div>
                  </section>

                  {/* Testimonials Section */}
                  <section className="px-8 py-12">
                    <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">What Our Users Say</h2>
                    
                    <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                      <div className="bg-white/5 rounded-lg p-5 backdrop-blur-sm border border-white/10">
                        <div className="flex flex-col h-full">
                          <div className="mb-3 flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <svg key={star} className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                          <p className="text-gray-300 text-sm flex-grow">
                            "SmartApp Studio cut my development time in half. The AI generates high-quality code that's ready to deploy."
                          </p>
                          <div className="mt-4 flex items-center">
                            <div className="h-8 w-8 rounded-full bg-indigo-700 flex items-center justify-center text-white font-bold text-xs">
                              JD
                            </div>
                            <div className="ml-2">
                              <div className="font-medium text-sm">John Doe</div>
                              <div className="text-xs text-gray-400">Senior Developer</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white/5 rounded-lg p-5 backdrop-blur-sm border border-white/10">
                        <div className="flex flex-col h-full">
                          <div className="mb-3 flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <svg key={star} className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                          <p className="text-gray-300 text-sm flex-grow">
                            "The blockchain integration saved us months of development. We now have a secure system our clients love."
                          </p>
                          <div className="mt-4 flex items-center">
                            <div className="h-8 w-8 rounded-full bg-purple-700 flex items-center justify-center text-white font-bold text-xs">
                              AS
                            </div>
                            <div className="ml-2">
                              <div className="font-medium text-sm">Alice Smith</div>
                              <div className="text-xs text-gray-400">CTO, FinTech Startup</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white/5 rounded-lg p-5 backdrop-blur-sm border border-white/10">
                        <div className="flex flex-col h-full">
                          <div className="mb-3 flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <svg key={star} className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                          <p className="text-gray-300 text-sm flex-grow">
                            "As a solo developer, SmartApp Studio feels like having an entire engineering team at my disposal."
                          </p>
                          <div className="mt-4 flex items-center">
                            <div className="h-8 w-8 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-xs">
                              MJ
                            </div>
                            <div className="ml-2">
                              <div className="font-medium text-sm">Mike Johnson</div>
                              <div className="text-xs text-gray-400">Indie Developer</div>
                            </div>
                          </div>
                        </div>
                      </div>
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