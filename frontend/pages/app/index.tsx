import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '../../hooks/useWallet';
import Head from 'next/head';
import LicenseInfoComponent from '../../components/LicenseInfo';
import { checkLicenseValidity, createNewProject, getUserProjects, Project } from '../../services/licenseService';

const AppPage = () => {
  const router = useRouter();
  const { accountId, isConnected } = useWallet();
  const [showLicenseInfo, setShowLicenseInfo] = useState(false);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

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
      setProjectLoading(true);
      setProjectError(null);
      console.log('Creating new project...');
      
      // Get project name - could use a modal in a real app
      const projectName = prompt('Digite o nome do seu novo projeto:') || 'Novo Projeto';
      
      if (!projectName.trim()) {
        setProjectError('Nome do projeto não pode ser vazio');
        setProjectLoading(false);
        return;
      }
      
      const result = await createNewProject(
        licenseInfo.topicId,
        accountId,
        projectName
      );
      
      if (result.success) {
        console.log('Project created successfully', result);
        alert(`Projeto "${projectName}" criado com sucesso!\nTopic ID: ${result.projectTopicId}`);
        
        // Add the new project to the list
        const newProject: Project = {
          projectTopicId: result.projectTopicId,
          projectName,
          createdAt: new Date().toISOString(),
          ownerAccountId: accountId
        };
        
        setProjects(prev => [...prev, newProject]);
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
                            <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Novo Projeto
                          </>
                        )}
                      </button>
                    </div>
                    
                    {loadingProjects ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                      </div>
                    ) : projects.length === 0 ? (
                      <div className="text-center p-8 bg-gray-800/50 rounded-lg border border-gray-700">
                        <p className="text-gray-400">Você ainda não possui projetos</p>
                        <p className="mt-2 text-sm text-gray-500">
                          Clique em "Novo Projeto" para começar
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {projects.map(project => (
                          <div 
                            key={project.projectTopicId}
                            className="bg-black/40 p-6 rounded-lg border border-gray-700 shadow-sm hover:shadow-md transition-shadow duration-200"
                          >
                            <h4 className="text-lg font-medium text-gray-200 mb-2">{project.projectName}</h4>
                            <p className="text-sm text-gray-400 mb-4">
                              Criado em: {new Date(project.createdAt).toLocaleDateString()}
                            </p>
                            <div className="flex justify-between items-center mt-4">
                              <span className="text-xs text-gray-500 font-mono truncate">
                                {project.projectTopicId}
                              </span>
                              <button
                                onClick={() => openProject(project.projectTopicId, project.projectName)}
                                className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-blue-300 bg-blue-900/40 hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              >
                                Abrir
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default AppPage; 