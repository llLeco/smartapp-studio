import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Chat from '../components/Chat';
import Sidebar from '../components/Sidebar';
import { useWallet } from '../hooks/useWallet';

export default function Home() {
  const router = useRouter();
  const { isConnected, accountId } = useWallet();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { projectId } = router.query;

  useEffect(() => {
    // Redirecionar para a página de app se não tiver um projectId
    if (!projectId && isConnected) {
      router.push('/app');
    }
    
    // Redirecionar para a página de acesso se não estiver conectado
    if (!isConnected || !accountId) {
      router.push('/get-access');
    }
  }, [isConnected, accountId, projectId, router]);

  // Se não estiver conectado ou o projeto não estiver definido, não renderiza o conteúdo principal
  if (!isConnected || !accountId || !projectId) {
    return null;
  }

  return (
    <>
      <Head>
        <title>
          {projectId ? `Projeto ${projectId}` : 'SmartApp Studio'}
        </title>
        <meta name="description" content="Smart App Studio - Construa aplicativos inteligentes" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex h-screen overflow-hidden text-white">
        {/* Sidebar - visível apenas em telas maiores */}
        <div className={`hidden md:block w-72 border-r border-white/10 bg-black/30 backdrop-blur-md`}>
          <Sidebar generatedStructure={null} />
        </div>

        {/* Conteúdo principal */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto">
            <Chat 
              onSendMessage={async (message) => {
                console.log(`Message sent: ${message}`);
                return "This is a placeholder response";
              }}
              generatedStructure={null}
            />
          </main>
        </div>
      </div>
    </>
  );
} 