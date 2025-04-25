import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '../../hooks/useWallet';
import Head from 'next/head';
import SubscriptionModal from '../../components/SubscriptionModal';
import SubscriptionBanner from '../../components/SubscriptionBanner';
import { checkLicenseValidity, createNewProject, getUserProjects, Project, getTokenDetails } from '../../services/licenseService';
import { getSubscriptionDetails, mapSubscriptionToInfo, SubscriptionInfo as SubInfo } from '../../services/subscriptionService';

// Configurar URL base do backend
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const api = (path: string) => `${BACKEND_URL}${path.startsWith('/') ? path : '/' + path}`;

// Interface for subscription details
interface SubscriptionInfo {
  active: boolean;
  expiresAt: string;
  projectLimit: number;
  messageLimit: number;
  projectsUsed: number;
  messagesUsed: number;
}

const AppPage = () => {
  const router = useRouter();
  const { accountId, isConnected } = useWallet();
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  
  // Estado para os modais
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [paymentData, setPaymentData] = useState<{
    tokenId: string;
    receiverAccountId: string;
  }>({ tokenId: '', receiverAccountId: '' });

  useEffect(() => {
    // Redirecionar para a página de acesso se não estiver conectado
    if (!isConnected || !accountId) {
      console.log('Not connected or no account ID, redirecting to get-access page', { isConnected, accountId });
      router.push('/get-access');
    } else {
      console.log('User authenticated in app page', { accountId, isConnected });
      // Fetch license info for the user
      fetchLicenseInfo();
    }
  }, [isConnected, accountId, router]);

  // Fetch license information
  const fetchLicenseInfo = async () => {
    if (!accountId) return;
    
    try {
      const { licenseInfo: info } = await checkLicenseValidity(accountId);
      console.log('License info loaded:', info);
      setLicenseInfo(info);
      
      // If we have a license topic, fetch projects and subscription
      if (info?.topicId) {
        // First fetch projects and then subscription details to make use of the cache
        await fetchUserProjects(info.topicId);
        // Now fetch subscription which will use the cached topic messages
        await fetchSubscriptionDetails(info.topicId);
      } else {
        // Set default subscription state if no license found
        setSubscription({
          active: false,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          projectLimit: 3,
          messageLimit: 100,
          projectsUsed: 0,
          messagesUsed: 0
        });
      }
    } catch (err) {
      console.error('Error fetching license info:', err);
    }
  };
  
  // Fetch user projects
  const fetchUserProjects = async (topicId: string) => {
    try {
      setLoadingProjects(true);
      console.log('Fetching projects for topic:', topicId);
      const userProjects = await getUserProjects(topicId);
      console.log('User projects loaded:', userProjects);
      setProjects(userProjects);
      
      // Update projects used count in subscription if it exists
      if (subscription) {
        setSubscription({
          ...subscription,
          projectsUsed: userProjects.length
        });
      }
    } catch (err) {
      console.error('Error fetching user projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  // Fetch subscription details
  const fetchSubscriptionDetails = async (topicId: string) => {
    try {
      setLoadingSubscription(true);
      console.log('Fetching subscription details for topic:', topicId);
      
      const result = await getSubscriptionDetails(topicId);
      console.log('Subscription details loaded:', result);
      
      if (result.success && result.subscription) {
        console.log('Subscription details loaded:', result.subscription);
        // Map the API subscription details to our frontend model
        // Use the projects length as the projectsUsed count
        const subscriptionInfo = mapSubscriptionToInfo(result.subscription, projects.length);
        setSubscription(subscriptionInfo);
      } else {
        console.warn('No subscription found or error:', result.error);
        // Set default subscription state
        setSubscription({
          active: false,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          projectLimit: 3,
          messageLimit: 100,
          projectsUsed: 0,
          messagesUsed: 0
        });
      }
    } catch (err) {
      console.error('Error fetching subscription details:', err);
    } finally {
      setLoadingSubscription(false);
    }
  };

  const handleCreateProject = async () => {
    if (!accountId || !licenseInfo?.topicId) {
      setProjectError('Conta ou licença não disponível. Verifique sua conexão.');
      return;
    }
    
    // Check if subscription is active and project limit not reached
    if (!subscription?.active || subscription.projectsUsed >= subscription.projectLimit) {
      setProjectError('Limite de projetos atingido ou assinatura inativa.');
      return;
    }
    
    try {
      setProjectLoading(true);
      
      // Create a project name with timestamp to make it unique
      const projectName = `Project ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
      
      // Use a fixed message limit for the new project
      const result = await createNewProject(
        licenseInfo.topicId,
        accountId,
        projectName,
        10 // Default message limit per project
      );
      
      if (result.success) {
        console.log('Project created successfully', result);
        
        // Add the new project to the list
        if (result.projectTopicId) {
          const newProject: Project = {
            projectTopicId: result.projectTopicId,
            projectName: projectName,
            createdAt: new Date().toISOString(),
            ownerAccountId: accountId
          };
          
          setProjects(prev => [...prev, newProject]);
          
          // Update projects used count in subscription
          if (subscription) {
            setSubscription({
              ...subscription,
              projectsUsed: subscription.projectsUsed + 1
            });
          }
        }
      } else {
        setProjectError(result.error || 'Erro ao criar projeto');
      }
    } catch (err: any) {
      console.error('Error creating project:', err);
      setProjectError(err.message || 'Erro ao criar projeto');
    } finally {
      setProjectLoading(false);
    }
  };
  
  const handlePurchaseSubscription = async () => {
    // if (!accountId || !licenseInfo?.topicId) {
    //   setProjectError('Conta ou licença não disponível. Verifique sua conexão.');
    //   return;
    // }
    
    // try {
    //   // Get the HSUITE token ID from environment
    //   const hsuiteTokenId = process.env.NEXT_PUBLIC_HSUITE_TOKEN_ID || '0.0.2203022';
      
    //   // Get operator ID for the transaction
    //   const operatorRes = await fetch(api('/api/hedera/getOperatorId'));
    //   const operatorData = await operatorRes.json();
      
    //   if (!operatorData.success || !operatorData.data) {
    //     throw new Error('Operator ID not available');
    //   }
      
    //   // Set up payment data
    //   setPaymentData({
    //     tokenId: hsuiteTokenId,
    //     receiverAccountId: operatorData.data
    //   });
      
    //   // Show the subscription payment modal
    //   setShowSubscriptionModal(true);
      
    // } catch (err: any) {
    //   console.error('Error preparing subscription:', err);
    //   setProjectError(err.message || 'Error preparing subscription');
    // }
  };
  
  const handleSubscriptionConfirm = async (transactionId: string) => {
    // try {
    //   // Fetch the updated subscription status from the backend
    //   const response = await fetch(api(`/api/subscription/status?accountId=${accountId}`));
    //   const data = await response.json();
      
    //   if (data.success) {
    //     setSubscription({
    //       active: true,
    //       expiresAt: data.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    //       projectLimit: data.projectLimit || 3,
    //       messageLimit: data.messageLimit || 100,
    //       projectsUsed: data.projectsUsed || 0,
    //       messagesUsed: data.messagesUsed || 0
    //     });
    //   }
    // } catch (error) {
    //   console.error('Error updating subscription status:', error);
    // } finally {
    //   // Always close the modal after handling the confirmation
    //   setShowSubscriptionModal(false);
    // }
  };

  const openProject = (projectId: string, projectName: string) => {
    console.log(`Opening project: ${projectName} (${projectId})`);
    router.push(`/chat/${projectId}`);
  };

  if (!isConnected || !accountId) {
    return null; // Não renderiza nada enquanto redireciona
  }

  return (
    <>
      <Head>
        <title>SmartApp Studio</title>
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
                  {/* Subscription Banner - only show when subscription is not active */}
                  {(!subscription?.active) && (
                    <div className="px-8 py-8 border-b border-white/10">
                      <SubscriptionBanner 
                        subscription={subscription}
                        loading={loadingSubscription}
                        onPurchase={handlePurchaseSubscription}
                        isProcessing={projectLoading}
                      />
                    </div>
                  )}
                  
                  {/* Projects Section with improved styling */}
                  <div className="px-8 py-10">
                    {/* Section Header with gradient accent */}
                    <div className="relative mb-10">
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-16 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
                      <div className="pl-6">
                        <h2 className="text-3xl font-bold mb-2 text-white">My Projects</h2>
                        <p className="text-gray-400 max-w-2xl">
                          Create and manage your smart app projects securely stored on the Hedera network.
                        </p>
                      </div>
                    </div>
                    
                    {/* Error message */}
                    {projectError && (
                      <div className="mb-8 p-4 bg-red-900/30 border border-red-800/50 rounded-lg">
                        <div className="flex items-center">
                          <svg className="h-5 w-5 text-red-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-red-200 text-sm font-medium">{projectError}</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Action Bar */}
                    <div className="flex items-center justify-between mb-8">
                      {/* Subscription Stats (only shown when active) */}
                      {subscription?.active && (
                        <div className="flex items-center space-x-6">
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                            <span className="text-sm text-gray-300">
                              <span className="font-medium text-white">{projects.length}</span>/{subscription.projectLimit} Projects
                            </span>
                          </div>
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                            <span className="text-sm text-gray-300">
                              {(() => {
                                const expiresDate = new Date(subscription.expiresAt);
                                const today = new Date();
                                const daysLeft = Math.ceil((expiresDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                return (
                                  <>
                                    <span className="font-medium text-white">{daysLeft} days</span> left (expires {expiresDate.toLocaleDateString()})
                                  </>
                                );
                              })()}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Create Project Button */}
                      {subscription?.active && subscription.projectsUsed < subscription.projectLimit ? (
                        <button 
                          onClick={handleCreateProject}
                          disabled={projectLoading}
                          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg font-medium text-white shadow-lg hover:from-blue-700 hover:to-indigo-800 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                          {projectLoading ? (
                            <>
                              <svg className="animate-spin h-4 w-4 text-white mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Creating Project...
                            </>
                          ) : (
                            <>
                              <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              Create New Project
                            </>
                          )}
                        </button>
                      ) : (
                        !subscription?.active && (
                          <div className="text-sm text-gray-400 italic">
                            Subscribe to create projects
                          </div>
                        )
                      )}
                    </div>
                    
                    {/* Projects Grid */}
                    {loadingProjects ? (
                      <div className="py-10 flex justify-center">
                        <div className="animate-pulse flex space-x-3">
                          <div className="h-3 w-3 bg-blue-400 rounded-full"></div>
                          <div className="h-3 w-3 bg-blue-400 rounded-full"></div>
                          <div className="h-3 w-3 bg-blue-400 rounded-full"></div>
                        </div>
                      </div>
                    ) : projects.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 px-6">
                        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 p-6 rounded-full mb-6">
                          <svg className="h-14 w-14 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <h3 className="text-xl font-medium text-white mb-2">No projects yet</h3>
                        <p className="text-gray-400 text-center max-w-md">
                          {subscription?.active 
                            ? 'Get started by creating your first project using the button above' 
                            : 'Subscribe to our service to start creating amazing smart app projects'}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {projects.map((project) => (
                          <div
                            key={project.projectTopicId}
                            className="group relative rounded-xl overflow-hidden border border-gray-700/50 bg-gradient-to-br from-gray-800/30 to-gray-900/70 backdrop-blur-sm hover:border-indigo-500/30 hover:from-indigo-900/10 hover:to-indigo-900/20 transition-all duration-300 cursor-pointer shadow-md"
                            onClick={() => openProject(project.projectTopicId, project.projectName)}
                          >
                            {/* Project card content */}
                            <div className="p-5">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                                  {project.projectName}
                                </h3>
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-900/20 group-hover:bg-indigo-500/30 transition-colors">
                                  <svg className="w-4 h-4 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                  </svg>
                                </div>
                              </div>
                              <div className="mb-3">
                                <div className="text-xs text-gray-400">
                                  Created {new Date(project.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                              <div className="flex items-center">
                                <div className="w-2 h-2 rounded-full bg-indigo-500 mr-2"></div>
                                <p className="text-xs text-gray-400 font-mono truncate">
                                  {project.projectTopicId}
                                </p>
                              </div>
                            </div>
                            {/* Hover effect lighting */}
                            <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
      
      {/* Modais */}
      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onConfirm={handleSubscriptionConfirm}
        tokenId={paymentData.tokenId}
        receiverAccountId={paymentData.receiverAccountId}
      />
    </>
  );
};

export default AppPage; 