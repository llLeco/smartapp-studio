import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useWallet } from '../../hooks/useWallet';
import Head from 'next/head';

const AppPage = () => {
  const router = useRouter();
  const { accountId, isConnected } = useWallet();

  useEffect(() => {
    // Redirecionar para a página de acesso se não estiver conectado
    if (!isConnected || !accountId) {
      router.push('/get-access');
    }
  }, [isConnected, accountId, router]);

  if (!isConnected || !accountId) {
    return null; // Não renderiza nada enquanto redireciona
  }

  return (
    <>
      <Head>
        <title>SmartApp Studio</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-800 dark:text-white">Smart<span className="text-blue-600">App</span> Studio</h1>
              </div>
              <div className="flex items-center">
                <div className="ml-3 relative">
                  <div className="bg-blue-100 dark:bg-blue-800 px-3 py-1 rounded-full text-sm text-blue-800 dark:text-blue-200">
                    {accountId}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main>
          <div className="max-w-7xl mx-auto py-12 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
              <div className="p-8 rounded-lg bg-white dark:bg-gray-800 shadow">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Bem-vindo ao SmartApp Studio</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Sua licença está ativa e você pode usar todos os recursos da plataforma.
                </p>
                <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Card de exemplo */}
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-6 rounded-lg border border-blue-100 dark:border-blue-800">
                    <h3 className="text-lg font-medium text-blue-800 dark:text-blue-300 mb-2">Novo projeto</h3>
                    <p className="text-blue-600 dark:text-blue-400 text-sm">
                      Crie um novo projeto SmartApp com IA e Hedera.
                    </p>
                    <button className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                      Iniciar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default AppPage; 