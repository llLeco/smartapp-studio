import {
    AccountId,
    TransferTransaction,
    TokenAssociateTransaction,
    Hbar,
    TokenInfoQuery,
    AccountBalanceQuery,
    TokenId
  } from '@hashgraph/sdk';
  import type { DAppSigner } from '@hashgraph/hedera-wallet-connect';
  
  // ===== CONFIGURAÇÕES =====
  const HEDERA_NETWORK = 'testnet'; // ou 'mainnet'
  
  // ===== TIPAGENS =====
  interface HederaServiceResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
  }
  
  // ===== FUNÇÕES AUXILIARES =====
  const extractErrorCode = (error: any): string => {
    const msg = error?.toString() || '';
    const codes = [
      'TOKEN_NOT_ASSOCIATED_TO_ACCOUNT',
      'TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT',
      'INSUFFICIENT_TRANSACTION_FEE',
      'INSUFFICIENT_PAYER_BALANCE',
      'INSUFFICIENT_TOKEN_BALANCE',
      'ACCOUNT_FROZEN_FOR_TOKEN',
      'INVALID_ACCOUNT_ID',
      'INVALID_TOKEN_ID'
    ];
    return codes.find(code => msg.includes(code)) || 'UNKNOWN_ERROR';
  };
  
  // ===== FUNÇÃO PRINCIPAL PARA OBTER O SIGNER =====
  const getSigner = async (): Promise<DAppSigner> => {
    try {
      const { default: getDAppConnector } = await import('./walletConnect');
      const connector = await getDAppConnector(false); // tenta usar a instância existente primeiro
      
      if (!connector?.signers?.length) {
        // Se não tiver signers, tentar forçar uma nova instância
        console.warn("Nenhum signer encontrado, tentando criar uma nova instância...");
        const newConnector = await getDAppConnector(true); // força nova instância
        
        if (!newConnector?.signers?.length) {
          // Se ainda não tiver signers, o usuário precisa reconectar
          throw new Error('Wallet não conectada ou sessão expirada. Reconecte sua carteira.');
        }
        
        return newConnector.signers[0];
      }
      
      return connector.signers[0];
    } catch (error) {
      console.error("Erro ao obter signer:", error);
      // Ao ocorrer erro, tentar limpar os dados do WalletConnect
      try {
        const { resetDAppConnector } = await import('./walletConnect');
        await resetDAppConnector();
      } catch (e) {
        // Ignorar erros na limpeza
      }
      throw error;
    }
  };
  
  // ===== OBTER ACCOUNT ID =====
  export const getAccountId = async (): Promise<string> => {
    const signer = await getSigner();
    return signer.accountId.toString();
  };
  
  // ===== CONSULTAS DE SALDO USANDO MIRROR NODE =====
  export const getHbarBalance = async (): Promise<HederaServiceResponse<string>> => {
    try {
      const accountId = await getAccountId();
      const res = await fetch(`https://${HEDERA_NETWORK}.mirrornode.hedera.com/api/v1/accounts/${accountId}`);
      const json = await res.json();
      const tinyBars = json?.balance?.balance || 0;
      const hbar = (tinyBars / 1e8).toFixed(8);
      return { success: true, data: hbar };
    } catch (e: any) {
      return { success: false, error: e.message, code: extractErrorCode(e) };
    }
  };
  
  export const getTokenBalance = async (tokenId: string): Promise<HederaServiceResponse<string>> => {
    try {
      const accountId = await getAccountId();
      const res = await fetch(`https://${HEDERA_NETWORK}.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens?token.id=${tokenId}&limit=1`);
      const json = await res.json();
      const balance = json?.tokens?.[0]?.balance || '0';
      return { success: true, data: balance };
    } catch (e: any) {
      return { success: false, error: e.message, code: extractErrorCode(e) };
    }
  };
  
  // ===== TRANSFERÊNCIAS =====
  export const transferToken = async (tokenId: string, receiverId: string, amount: number): Promise<HederaServiceResponse> => {
    try {
      const signer = await getSigner();
      const senderId = signer.accountId.toString();
      const tx = await new TransferTransaction()
        .addTokenTransfer(tokenId, senderId, -amount)
        .addTokenTransfer(tokenId, receiverId, amount)
        .freezeWith(signer.client);
  
      if (!signer.signTransaction) {
        throw new Error('Método signTransaction não disponível no signer. Reconecte sua carteira.');
      }
      
      const signed = await signer.signTransaction(tx);
      const res = await signed.execute(signer.client);
      return { success: true, data: { txId: res.transactionId.toString() } };
    } catch (e: any) {
      return { success: false, error: e.message, code: extractErrorCode(e) };
    }
  };
  
  export const transferHbar = async (receiverId: string, amount: number): Promise<HederaServiceResponse> => {
    try {
      const signer = await getSigner();
      const senderId = signer.accountId.toString();
      const tx = await new TransferTransaction()
        .addHbarTransfer(senderId, new Hbar(-amount))
        .addHbarTransfer(receiverId, new Hbar(amount))
        .freezeWith(signer.client);
  
      if (!signer.signTransaction) {
        throw new Error('Método signTransaction não disponível no signer. Reconecte sua carteira.');
      }
      
      const signed = await signer.signTransaction(tx);
      const res = await signed.execute(signer.client);
      return { success: true, data: { txId: res.transactionId.toString() } };
    } catch (e: any) {
      return { success: false, error: e.message, code: extractErrorCode(e) };
    }
  };
  
  // ===== ASSOCIAR TOKEN =====
  export const associateToken = async (tokenId: string): Promise<HederaServiceResponse> => {
    try {
      const signer = await getSigner();
      const tx = await new TokenAssociateTransaction()
        .setAccountId(AccountId.fromString(signer.accountId.toString()))
        .setTokenIds([tokenId])
        .freezeWith(signer.client);

      if (!signer.signTransaction) {
        throw new Error('Método signTransaction não disponível no signer. Reconecte sua carteira.');
      }
      
      const signed = await signer.signTransaction(tx);
      const res = await signed.execute(signer.client);
      return { success: true, data: { txId: res.transactionId.toString() } };
    } catch (e: any) {
      if (e.toString().includes('TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) {
        return { success: true, data: { alreadyAssociated: true }, code: 'TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT' };
      }
      return { success: false, error: e.message, code: extractErrorCode(e) };
    }
  };
  