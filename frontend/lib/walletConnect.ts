import {
  DAppConnector,
  HederaJsonRpcMethod,
  HederaSessionEvent,
  HederaChainId,
  DAppConnectorInitOptions
} from '@hashgraph/hedera-wallet-connect';
import { LedgerId } from '@hashgraph/sdk';

const metadata = {
  name: 'SmartApp Studio',
  description: 'Construa apps com IA e HSuite',
  url: 'https://smartapp.studio',
  icons: ['https://smartapp.studio/logo.png']
};

const createDAppConnector = async (): Promise<DAppConnector> => {
  const connector = new DAppConnector(
    metadata,
    LedgerId.TESTNET,
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'e86cf7db9874405c556da31fa2277367',
    Object.values(HederaJsonRpcMethod),
    [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
    [HederaChainId.Testnet],
    {
      disableSessionRecovery: true,
      disableAutoConnectOnStart: true
    }
  );

  await connector.init({ logger: 'error' });
  return connector;
};

let sharedInstance: DAppConnector | null = null;

const getDAppConnector = async (forceNew = false): Promise<DAppConnector> => {
  if (!sharedInstance || forceNew) {
    sharedInstance = await createDAppConnector();
  }
  return sharedInstance;
};

const resetDAppConnector = () => {
  sharedInstance = null;
};

export default getDAppConnector;
export { createDAppConnector, resetDAppConnector };