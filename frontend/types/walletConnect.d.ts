// Type definitions for DAppConnector from @hashgraph/hedera-wallet-connect

declare module '@hashgraph/hedera-wallet-connect' {
  // Interface para o DAppSigner com accountId
  export interface DAppSigner {
    accountId: string | { toString(): string };
    signClient: any;
    topic: string;
    ledgerId: any;
    client?: any;
    signTransaction?: (tx: any) => Promise<any>;
    [key: string]: any;
  }

  // Interface para opções de inicialização estendidas
  export interface DAppConnectorInitOptions {
    logger?: string;
    relayUrl?: string;
    storageOptions?: {
      database?: string;
      [key: string]: any;
    };
    disableSessionRecovery?: boolean;
    disableAutoConnectOnStart?: boolean;
    [key: string]: any;
  }

  export class DAppConnector {
    session: any;
    signers: DAppSigner[];
    client?: any;
    
    // Métodos de EventEmitter opcionais (podem existir em algumas versões)
    on?: (event: string, listener: (...args: any[]) => void) => void;
    off?: (event: string, listener: (...args: any[]) => void) => void;
    once?: (event: string, listener: (...args: any[]) => void) => void;
    
    // Métodos de conexão/desconexão (diferentes versões podem usar nomes diferentes)
    killSession?: () => Promise<void>;
    disconnect?: () => Promise<void>;
    closeSession?: () => Promise<void>;
    destroy?: () => Promise<void>;
    
    constructor(
      metadata: any,
      ledgerId: any,
      projectId: string,
      methods: any[],
      events: any[],
      chains: any[],
      options?: {
        disableSessionRecovery?: boolean;
        disableAutoConnectOnStart?: boolean;
        [key: string]: any;
      }
    );
    
    init(options: DAppConnectorInitOptions | { logger: string }): Promise<void>;
    openModal(): Promise<any>;
  }
  
  export enum HederaJsonRpcMethod {
    // Enum values would be defined here
  }
  
  export enum HederaSessionEvent {
    ChainChanged = 'chainChanged',
    AccountsChanged = 'accountsChanged'
  }
  
  export enum HederaChainId {
    Mainnet = 'hedera:mainnet',
    Testnet = 'hedera:testnet'
  }
} 