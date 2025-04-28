import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '../../hooks/useWallet';
import Head from 'next/head';
import SubscriptionModal from '../../components/SubscriptionModal';
import SubscriptionBanner from '../../components/SubscriptionBanner';
import ProjectCreateModal from '../../components/ProjectCreateModal';
import { getUserLicense, Project } from '../../services/licenseService';
import { createProject, getUserProjects } from '../../services/projectService';
import { 
  getSubscriptionDetails, 
  mapSubscriptionToInfo, 
  SubscriptionInfo as SubInfo,
} from '../../services/subscriptionService';

// Configurar URL base do backend
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const api = (path: string) => `${BACKEND_URL}${path.startsWith('/') ? path : '/' + path}`;

// Interface for subscription details
interface SubscriptionInfo {
  active: boolean;
  expired: boolean;
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
  const [renewalLoading, setRenewalLoading] = useState(false);
  
  // Estado para os modais
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showProjectCreateModal, setShowProjectCreateModal] = useState(false);
  const [isRenewalMode, setIsRenewalMode] = useState(false);

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
      const license = await getUserLicense(accountId);

      // If we have a license topic, fetch projects and subscription
      if (license && license?.topicId) {
        setLicenseInfo(license);
        // First fetch projects and then subscription details to make use of the cache
        await fetchUserProjects(license.topicId);
        // Now fetch subscription which will use the cached topic messages
        await fetchSubscriptionDetails(license.topicId);
      } else {
        console.log('No license topic found, checking subscription by account');
      }
    } catch (err) {
      console.error('Error fetching license info:', err);
    }
  };
  
  // Fetch user projects
  const fetchUserProjects = async (topicId: string) => {
    try {
      setLoadingProjects(true);
      const userProjects = await getUserProjects(topicId);
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

  // Fetch subscription details - this version directly accesses the topic
  const fetchSubscriptionDetails = async (topicId: string) => {
    try {
      setLoadingSubscription(true);
      console.log('Fetching subscription details for topic:', topicId);
      
      const result = await getSubscriptionDetails(topicId);
      
      if (result.success && result.subscription) {
        console.log('Subscription details loaded:', result.subscription);
        
        // Check if this is a new subscription (reset project limits)
        const isNewSubscription = result.active || false;
        
        // Map the API subscription details to our frontend model
        // When a new subscription is created, reset projectsUsed to 0
        const projectCount = isNewSubscription ? 0 : projects.length;
        const subscriptionInfo = mapSubscriptionToInfo(result.subscription, projectCount);
        
        setSubscription(subscriptionInfo);
        
        // If this is a new subscription, update the projects display in the UI
        if (isNewSubscription) {
          console.log("New subscription detected - resetting projects used count to 0");
          
          // Force update the UI without changing actual projects array
          // This ensures the Create Project button is enabled
          setProjects(prevProjects => {
            // Simply return the same array to maintain references
            // but UI will reflect the projectsUsed=0 from subscription
            return [...prevProjects];
          });
        }
      } else {
        console.warn('No subscription found or error:', result.error);
        // Set default subscription state
        setSubscription({
          active: false,
          expired: false,
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

  const handleCreateProject = async (projectName: string) => {
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
      
      // Use the project name provided by the user
      const result = await createProject(
        projectName,
        accountId,
        licenseInfo.topicId,
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
      setShowProjectCreateModal(false);
    }
  };
  
  const handlePurchaseSubscription = async (isRenewal: boolean = false) => {
    if (!accountId || !licenseInfo?.topicId) {
      setProjectError('Conta ou licença não disponível. Verifique sua conexão.');
      return;
    }
    
    try {
      // Get the HSUITE token ID from environment
      const hsuiteTokenIdRes = await fetch(api('/api/hedera/hsuitetokenid'));
      const hsuiteTokenIdData = await hsuiteTokenIdRes.json();
      const hsuiteTokenId = hsuiteTokenIdData.tokenId;

      console.log('HSUITE token ID:', hsuiteTokenId);
      
      // Get operator ID for the transaction
      const operatorRes = await fetch(api('/api/hedera/network'));
      const operatorData = await operatorRes.json();

      console.log('Operator ID:', operatorData);
      
      if (!operatorData.success || !operatorData.operatorId) {
        throw new Error('Operator ID not available');
      }
      
      // Set renewal mode
      setIsRenewalMode(isRenewal);
      
      // Show the subscription payment modal
      setShowSubscriptionModal(true);
      
    } catch (err: any) {
      console.error('Error preparing subscription:', err);
      setProjectError(err.message || 'Error preparing subscription');
    }
  };
  
  const handleSubscriptionConfirm = async (transactionId: string) => {
    try {
      setRenewalLoading(true);
      
      // For both new and renewal subscriptions, just process the transaction ID
      console.log('Subscription confirmed with transaction:', transactionId);
      
      // Simulate successful response
      const success = true;
      
      if (success) {
        // Refresh subscription details if we have a license topic
        if (licenseInfo?.topicId) {
          await fetchSubscriptionDetails(licenseInfo.topicId);
        }
        
        // Hide any previous errors
        setProjectError(null);
      }
    } catch (error: any) {
      console.error('Error processing subscription:', error);
      setProjectError(error.message || 'Error processing subscription');
    } finally {
      setRenewalLoading(false);
      setShowSubscriptionModal(false);
    }
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
                  {/* Subscription Banner - only show when subscription is not active AND not expired */}
                  {(!subscription?.active && !subscription?.expired) && (
                    <div className="px-8 py-8 border-b border-white/10">
                      <SubscriptionBanner 
                        subscription={subscription}
                        license={licenseInfo}
                        loading={loadingSubscription}
                        onPurchase={() => handlePurchaseSubscription(false)}
                        isProcessing={projectLoading || renewalLoading}
                      />
                    </div>
                  )}
                  
                  {/* Expired Subscription Banner */}
                  {(subscription?.expired) && (
                    <div className="px-8 py-6 border-b border-amber-500/20 bg-amber-900/10">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-600/20 flex items-center justify-center">
                          <svg className="w-5 h-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-amber-300">Your subscription has expired</h3>
                          <p className="text-sm text-amber-200/70">Renew your subscription to continue using your projects and creating new ones.</p>
                        </div>
                        <button 
                          onClick={() => handlePurchaseSubscription(true)}
                          disabled={renewalLoading}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg shadow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {renewalLoading ? 'Processing...' : 'Renew Now'}
                        </button>
                      </div>
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
                              <span className="font-medium text-white">{subscription.projectsUsed}</span>/{subscription.projectLimit} Projects
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
                          onClick={() => setShowProjectCreateModal(true)}
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
                        (!subscription?.active || subscription?.expired) && (
                          <div className="text-sm text-gray-400 italic">
                            {subscription?.expired 
                              ? 'Renew your subscription to create projects' 
                              : 'Subscribe to create projects'}
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
                            : subscription?.expired
                              ? 'Renew your subscription to start creating projects again'
                              : 'Subscribe to our service to start creating amazing smart app projects'}
                        </p>
                      </div>
                    ) : (
                      <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 ${subscription?.expired ? 'opacity-60' : ''}`}>
                        {projects.map((project) => (
                          <div
                            key={project.projectTopicId}
                            className={`group relative rounded-xl overflow-hidden border border-gray-700/50 bg-gradient-to-br from-gray-800/30 to-gray-900/70 backdrop-blur-sm hover:border-indigo-500/30 hover:from-indigo-900/10 hover:to-indigo-900/20 transition-all duration-300 ${subscription?.expired ? 'cursor-not-allowed' : 'cursor-pointer shadow-md'}`}
                            onClick={subscription?.expired ? undefined : () => openProject(project.projectTopicId, project.projectName)}
                          >
                            {/* Expired overlay */}
                            {subscription?.expired && (
                              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10">
                                <div className="bg-black/70 px-4 py-2 rounded-lg border border-amber-600/30">
                                  <div className="flex items-center text-amber-500">
                                    <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                    </svg>
                                    <span className="text-xs font-medium">Locked</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            
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
      
      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onConfirm={handleSubscriptionConfirm}
        isRenewal={isRenewalMode}
      />
      
      {/* Project Create Modal */}
      <ProjectCreateModal
        isOpen={showProjectCreateModal}
        onClose={() => setShowProjectCreateModal(false)}
        onConfirm={handleCreateProject}
        isProcessing={projectLoading}
      />
    </>
  );
};

export default AppPage; 