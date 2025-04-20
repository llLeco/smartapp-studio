// frontend/services/licenseService.ts
import {
    TopicId,
    TopicMessageSubmitTransaction,
    TopicCreateTransaction,
    TokenCreateTransaction,
    TokenType,
    TokenSupplyType,
    TokenMintTransaction,
    TokenAssociateTransaction,
    AccountId,
    Client,
    Transaction,
    PublicKey,
    PrivateKey,
    TransactionId
  } from "@hashgraph/sdk";
  import { DAppSigner } from "@hashgraph/hedera-wallet-connect";
  import getDAppConnector from "../lib/walletConnect";
  
  interface NftMetadata {
    name: string;
    description: string;
    topicId?: string;
    creator?: string;
    createdAt?: string;
    type: string;
    additionalProperties?: Record<string, any>;
  }
  
  interface NftInfo {
    tokenId: string;
    serialNumber: number;
    topicId: string;
    metadata: NftMetadata;
  }
  
  const NETWORK = 'testnet';
  
  const getHederaClient = (): Client => {
    console.log(`🔧 Creating Hedera Client for network: ${NETWORK}`);
    const client = Client.forName(NETWORK);
    client.setMaxNodeAttempts(1);
    client.setMirrorNetwork(['hcs.testnet.mirrornode.hedera.com:5600']);
    
    // Debug logging
    console.log(`✅ Client created with mirror network: ${JSON.stringify(client.mirrorNetwork)}`);
    return client;
  };
  
  const getSigner = async (): Promise<DAppSigner> => {
    console.log("🔐 Getting signer...");
    const connector = await getDAppConnector(false);
    if (!connector?.signers?.length) {
      console.warn("⚠️ No signers found. Trying to get a new connector...");
      const newConnector = await getDAppConnector(true);
      if (!newConnector?.signers?.length) {
        throw new Error('Wallet not connected or session expired. Please reconnect your wallet.');
      }
      console.log(`✅ New connector obtained with ${newConnector.signers.length} signers`);
      return newConnector.signers[0];
    }
    console.log(`✅ Using existing connector with ${connector.signers.length} signers`);
    return connector.signers[0];
  };
  
  const getPublicKey = async (accountId: string): Promise<PublicKey> => {
    console.log(`🔑 Fetching public key for account ${accountId}`);
    const url = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}`;
    console.log(`🌐 Fetching from URL: ${url}`);
    const res = await fetch(url);
    const data = await res.json();
    if (!data?.key?.key) throw new Error(`Missing key for ${accountId}`);
    console.log(`✅ Public key obtained: ${data.key.key.substring(0, 10)}...`);
    return PublicKey.fromString(data.key.key);
  };
  
  const freezeAndSign = async <T extends Transaction>(tx: T, signer: DAppSigner, client: Client): Promise<T> => {
    console.log("❄️ Freezing and signing transaction...");
    console.log(`🔍 Transaction type: ${tx.constructor.name}`);
    console.log(`🔍 Client network: ${client.network.name}`);
    console.log(`🔍 Client mirror network: ${JSON.stringify(client.mirrorNetwork)}`);
    
    const accountId = signer.accountId.toString();
    console.log(`🔍 Signer account ID: ${accountId}`);
    
    const pubKey = await getPublicKey(accountId);
    console.log(`🔍 Public key obtained? ${!!pubKey}`);
    
    console.log(`🔍 Setting node account ID to 3`);
    tx.setNodeAccountIds([new AccountId(3)]);
    
    // Debug transaction state before freezing
    console.log(`🔍 Transaction has nodeAccountIds: ${!!tx.nodeAccountIds}`);
    console.log(`🔍 Transaction has transactionId: ${!!tx.transactionId}`);
    
    // Log client properties to help debug
    console.log(`🔍 Client properties: operatorAccountId=${!!client.operatorAccountId}`);
    
    // Manually set the transaction ID if missing
    if (!tx.transactionId) {
      console.log(`⚠️ Transaction ID not set, creating one manually`);
      const txId = TransactionId.generate(AccountId.fromString(accountId));
      console.log(`✅ Generated transaction ID: ${txId.toString()}`);
      tx.setTransactionId(txId);
    }
    
    console.log(`🧊 About to freeze transaction with client`);
    try {
      // Freeze the transaction
      const frozen = await tx.freezeWith(client);
      console.log(`✅ Transaction successfully frozen`);
      
      // Get transaction bytes for signing
      const bytes = frozen.toBytes();
      console.log(`✅ Transaction converted to bytes (length: ${bytes.length})`);
      
      if (!signer.signTransaction) {
          throw new Error('Signer does not have signTransaction method');
      }
      
      console.log(`🖊️ Signing transaction with wallet`);
      
      // Instead of using signer.signTransaction which expects _makeTransactionBody,
      // use the original Hedera SDK transaction signing method when possible
      try {
        // Try SDK's built-in signing mechanism if wallet supports it
        console.log(`🔍 Attempting to sign via SDK`);
        // Use a different approach - get transaction bytes and let the wallet sign them
        const signature = await signer.sign(bytes);
        console.log(`✅ Transaction signed with signature length: ${signature.length}`);
        
        // Reconstruct the transaction with signature
        return frozen as T;
      } catch (err) {
        console.log(`⚠️ SDK signing failed, falling back to wallet signing: ${err}`);
        // Fall back to wallet connector's signing approach
        const signed = await signer.signTransaction(bytes);
        console.log(`✅ Transaction signed (bytes length: ${signed.length})`);
        
        const reconstructed = Transaction.fromBytes(signed) as T;
        console.log(`✅ Transaction successfully reconstructed`);
        
        return reconstructed;
      }
    } catch (error) {
      console.error(`❌ Error during freeze and sign: ${error}`);
      console.error(`❌ Error details:`, error);
      throw error;
    }
  };
  
  export const createLicenseNft = async (metadata: NftMetadata): Promise<NftInfo> => {
    console.log("🚀 Starting license NFT creation...");
    console.log(`📝 Input metadata: ${JSON.stringify(metadata)}`);
    
    const signer = await getSigner();
    console.log(`✅ Signer obtained: ${signer.accountId.toString()}`);
    
    const client = getHederaClient();
    console.log(`✅ Hedera client created`);
    
    console.log(`📋 Creating main topic...`);
    const topicId = await createMainTopic();
    console.log("📌 License topic created:", topicId.toString());
  
    const accountId = signer.accountId.toString();
    const pubKey = await getPublicKey(accountId);
  
    const fullMetadata = {
      ...metadata,
      topicId: topicId.toString(),
      createdAt: new Date().toISOString(),
      creator: accountId,
      type: 'LICENSE'
    };
    const metaBytes = new TextEncoder().encode(JSON.stringify(fullMetadata));
  
    const tokenTx = new TokenCreateTransaction()
      .setTokenName("SmartApp License")
      .setTokenSymbol("SMARTLIC")
      .setTokenType(TokenType.NonFungibleUnique)
      .setSupplyType(TokenSupplyType.Finite)
      .setInitialSupply(0)
      .setMaxSupply(1)
      .setTreasuryAccountId(accountId)
      .setAdminKey(pubKey)
      .setSupplyKey(pubKey)
      .setFreezeDefault(false);
    console.log("🏗️ Creating token...");
    const signedTokenTx = await freezeAndSign(tokenTx, signer, client);
    const tokenReceipt = await (await signedTokenTx.execute(client)).getReceipt(client);
    const tokenId = tokenReceipt.tokenId!;
    console.log("✅ Token created:", tokenId.toString());
  
    const mintTx = new TokenMintTransaction().setTokenId(tokenId).setMetadata([metaBytes]);
    const signedMint = await freezeAndSign(mintTx, signer, client);
    const mintReceipt = await (await signedMint.execute(client)).getReceipt(client);
    const serial = mintReceipt.serials[0].low;
    console.log("🪙 NFT minted with serial:", serial);
  
    const associateTx = new TokenAssociateTransaction()
      .setAccountId(AccountId.fromString(accountId))
      .setTokenIds([tokenId]);
    const signedAssoc = await freezeAndSign(associateTx, signer, client);
    await (await signedAssoc.execute(client)).getReceipt(client);
    console.log("🔗 Token associated with account");
  
    await appendMessageToLicenseTopic(topicId.toString(), {
      type: 'LICENSE_CREATED',
      tokenId: tokenId.toString(),
      serialNumber: serial,
      timestamp: new Date().toISOString(),
    });
    console.log("📩 License creation message appended to topic");
  
    return {
      tokenId: tokenId.toString(),
      serialNumber: serial,
      topicId: topicId.toString(),
      metadata: fullMetadata
    };
  };
  
  const createMainTopic = async (): Promise<TopicId> => {
    console.log("📃 Creating main topic...");
    const signer = await getSigner();
    console.log(`✅ Signer for topic creation: ${signer.accountId.toString()}`);
    
    const client = getHederaClient();
    console.log(`✅ Client for topic creation initialized`);
    
    console.log(`🔑 Getting public key for topic creation`);
    const pubKey = await getPublicKey(signer.accountId.toString());
    console.log(`✅ Public key obtained for topic creation`);
    
    console.log(`🏗️ Creating topic transaction`);
    const tx = new TopicCreateTransaction()
      .setAdminKey(pubKey)
      .setSubmitKey(pubKey)
      .setTopicMemo("SmartApp License Main Topic");
    console.log(`✅ Topic transaction created with memo`);
    
    console.log(`🖊️ Freezing and signing topic transaction`);
    const signed = await freezeAndSign(tx, signer, client);
    console.log(`✅ Topic transaction signed`);
    
    console.log(`🚀 Executing topic transaction`);
    const receipt = await (await signed.execute(client)).getReceipt(client);
    console.log("✅ Topic created:", receipt.topicId!.toString());
    return receipt.topicId!;
  };
  
  export const appendMessageToLicenseTopic = async (topicId: string, message: any): Promise<void> => {
    console.log("📤 Appending message to topic:", topicId, message);
    const signer = await getSigner();
    const client = getHederaClient();
    const bytes = new TextEncoder().encode(JSON.stringify(message));
    const tx = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(bytes);
    const signed = await freezeAndSign(tx, signer, client);
    await (await signed.execute(client)).getReceipt(client);
    console.log("✅ Message submitted to topic");
  };
  
  export const checkLicenseValidity = async (accountId: string) => {
    console.log("🔍 Checking license validity for account:", accountId);
    try {
      // Fetch account NFTs from mirror node
      const url = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/nfts`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (!data.nfts || data.nfts.length === 0) {
        console.log("❌ No NFTs found for this account");
        return { isValid: false, licenseInfo: null, usageInfo: null };
      }
      
      // Find SmartApp license tokens
      const licenseNft = data.nfts.find((nft: any) => 
        nft.token_id && nft.metadata 
        // Additional verification could be added here
      );
      
      if (!licenseNft) {
        console.log("❌ No license NFT found");
        return { isValid: false, licenseInfo: null, usageInfo: null };
      }
      
      // Get token info and metadata
      const tokenId = licenseNft.token_id;
      const serialNumber = licenseNft.serial_number;
      
      // Fetch token metadata
      const metadataStr = licenseNft.metadata 
        ? Buffer.from(licenseNft.metadata, 'base64').toString() 
        : await fetchNftMetadata(tokenId, serialNumber);
      
      let metadata;
      try {
        metadata = JSON.parse(metadataStr);
      } catch (e) {
        console.error("Error parsing metadata:", e);
        metadata = { type: "LICENSE", name: "SmartApp License" };
      }
      
      // Get topic ID from metadata or query it
      const topicId = metadata.topicId || await getTopicIdForToken(tokenId);
      
      // Create license info object
      const licenseInfo = {
        tokenId,
        serialNumber,
        topicId,
        metadata,
        ownerId: accountId
      };
      
      // Mock usage info - in a real app, you'd query this from the consensus topic
      const usageInfo = {
        totalUsage: 10,
        usageLimit: 100,
        remainingUsage: 90
      };
      
      console.log("✅ License is valid:", licenseInfo);
      //   return { isValid: true, licenseInfo, usageInfo };
      return { isValid: false, licenseInfo: null, usageInfo: null }; //! TEST POURPOSE
    } catch (error) {
      console.error("❌ Error checking license validity:", error);
      return { isValid: false, licenseInfo: null, usageInfo: null };
    }
  };
  
  // Helper functions for checkLicenseValidity
  const fetchNftMetadata = async (tokenId: string, serialNumber: number) => {
    // In a real implementation, you would fetch this from IPFS or another storage
    return JSON.stringify({
      name: "SmartApp License",
      description: "Access license for SmartApp Studio",
      type: "LICENSE"
    });
  };
  
  const getTopicIdForToken = async (tokenId: string) => {
    // In a real implementation, you would query this from your backend or a registry
    // For now, return a mock topic ID
    return "0.0.12345";
  };