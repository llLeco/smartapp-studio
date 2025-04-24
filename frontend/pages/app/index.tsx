import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '../../hooks/useWallet';
import Head from 'next/head';
import LicenseInfoComponent from '../../components/LicenseInfo';
import ProjectPaymentModal from '../../components/ProjectPaymentModal';
import { checkLicenseValidity, createNewProject, getUserProjects, Project, getTokenDetails } from '../../services/licenseService';

// Configurar URL base do backend
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const api = (path: string) => `${BACKEND_URL}${path.startsWith('/') ? path : '/' + path}`;

const AppPage = () => {
  const router = useRouter();
  const { accountId, isConnected } = useWallet();
  const [showLicenseInfo, setShowLicenseInfo] = useState(false);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  
  // Estado para os modais
  const [showPaymentModal, setShowPaymentModal] = useState(false);
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
      
      // If we have a license topic, fetch projects
      if (info?.topicId) {
        fetchUserProjects(info.topicId);
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
    } catch (err) {
      console.error('Error fetching user projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  // Log when license info visibility changes
  useEffect(() => {
    console.log('License info visibility changed:', { showLicenseInfo });
  }, [showLicenseInfo]);

  const toggleLicenseInfo = () => {
    console.log('Toggling license info visibility from', showLicenseInfo, 'to', !showLicenseInfo);
    setShowLicenseInfo(!showLicenseInfo);
  };

  const handleCreateProject = async () => {
    if (!accountId || !licenseInfo?.topicId) {
      setProjectError('Conta ou licença não disponível. Verifique sua conexão.');
      return;
    }
    
    try {
      // Usar o token ID do Hsuite a partir do .env
      const hsuiteTokenId = process.env.NEXT_PUBLIC_HSUITE_TOKEN_ID || '0.0.2203022';
      
      // Obter operator ID para a transação
      const operatorRes = await fetch(api('/api/hedera/getOperatorId'));
      const operatorData = await operatorRes.json();
      
      if (!operatorData.success || !operatorData.data) {
        throw new Error('Operator ID não disponível');
      }
      
      // Configurar os dados necessários para o pagamento
      setPaymentData({
        tokenId: hsuiteTokenId,
        receiverAccountId: operatorData.data
      });
      
      // Mostrar o modal integrado de criação/pagamento
      setShowPaymentModal(true);
      
    } catch (err: any) {
      console.error('Error preparing project:', err);
      setProjectError(err.message || 'Erro ao preparar projeto');
    }
  };
  
  const handlePaymentConfirm = async (transactionId: string, projectName: string, chatCount: number) => {
    try {
      setProjectLoading(true);
      setShowPaymentModal(false);
      
      // Agora que o pagamento foi realizado, criar o projeto
      const result = await createNewProject(
        licenseInfo.topicId,
        accountId!,
        projectName,
        chatCount
      );
      
      if (result.success) {
        console.log('Project created successfully', result);
        alert(`Projeto "${projectName}" criado com sucesso!\nTopic ID: ${result.projectTopicId}\nMensagens disponíveis: ${chatCount}`);
        
        // Add the new project to the list
        if (result.projectTopicId) {
          const newProject: Project = {
            projectTopicId: result.projectTopicId,
            projectName: projectName,
            createdAt: new Date().toISOString(),
            ownerAccountId: accountId!
          };
          
          setProjects(prev => [...prev, newProject]);
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
      <div className="min-h-screen">
        <main className="pt-4 pb-20">
          <div className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
            {showLicenseInfo ? (
              <div className="px-4 py-6 sm:px-0">
                <LicenseInfoComponent onClose={() => {
                  console.log('Closing license info panel');
                  setShowLicenseInfo(false);
                }} />
              </div>
            ) : (
              <div className="px-4 py-6 sm:px-0">
                <div className="p-8 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10 shadow text-white">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold">Meus Projetos</h2>
                    <button
                      onClick={toggleLicenseInfo}
                      className="text-blue-300 hover:text-blue-100 text-sm"
                    >
                      Detalhes da Licença
                    </button>
                  </div>
                  
                  {projectError && (
                    <div className="mb-6 p-3 bg-red-900/30 rounded-lg text-red-200 text-sm">
                      {projectError}
                    </div>
                  )}
                  
                  <div className="mb-8">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-gray-300">
                        Gerencie seus projetos criados ou crie um novo.
                      </p>
                      <button 
                        onClick={handleCreateProject}
                        disabled={projectLoading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {projectLoading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processando...
                          </>
                        ) : (
                          <>
                            <svg className="-ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Criar Novo Projeto
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* Lista de projetos */}
                  {loadingProjects ? (
                    <div className="py-6 flex justify-center">
                      <div className="animate-pulse flex space-x-2">
                        <div className="h-3 w-3 bg-blue-400 rounded-full"></div>
                        <div className="h-3 w-3 bg-blue-400 rounded-full"></div>
                        <div className="h-3 w-3 bg-blue-400 rounded-full"></div>
                      </div>
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-300">Nenhum projeto</h3>
                      <p className="mt-1 text-sm text-gray-400">
                        Comece criando um novo projeto.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {projects.map((project) => (
                        <div
                          key={project.projectTopicId}
                          className="relative rounded-lg border border-white/10 bg-white/5 p-4 cursor-pointer hover:bg-white/10 transition"
                          onClick={() => openProject(project.projectTopicId, project.projectName)}
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white truncate">
                              {project.projectName}
                            </h3>
                            <div className="text-xs text-gray-400 whitespace-nowrap">
                              {new Date(project.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <p className="mt-1 text-xs text-gray-400 font-mono overflow-hidden text-ellipsis">
                            {project.projectTopicId}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
        
        {/* Modais */}
        <ProjectPaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={handlePaymentConfirm}
          tokenId={paymentData.tokenId}
          receiverAccountId={paymentData.receiverAccountId}
        />
      </div>
    </>
  );
};

export default AppPage; 