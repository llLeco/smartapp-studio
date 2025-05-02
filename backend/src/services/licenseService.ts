import { AccountId, PrivateKey, TokenId, TokenMintTransaction, TopicId, TopicMessageSubmitTransaction, TransferTransaction } from "@hashgraph/sdk";
import { getClient, getMirrorNodeUrl, getOperatorId } from "./hederaService";
import { getTopicMessages } from "./topicService";

export interface LicenseInfo {
    tokenId: string;
    serialNumber: number;
    topicId: string;
    metadata: NftMetadata;
    ownerId: string;
}

export interface NftMetadata {
    name: string;
    description: string;
    topicId?: string;
    creator?: string;
    createdAt?: string;
    type: string;
    image?: string;
}

export const getUserLicense = async (accountId: string) => {
    if (!process.env.LICENSE_TOKEN_ID) {
        throw new Error('LICENSE_TOKEN_ID environment variable is not set');
    }

    // Query directly for license NFTs using the tokenId parameter in the Mirror Node API
    const tokenId = process.env.LICENSE_TOKEN_ID;
    const limit = 100; // Set a reasonable limit
    const baseUrl = getMirrorNodeUrl();
    let url = `${baseUrl}/api/v1/accounts/${accountId}/nfts?token.id=${tokenId}&limit=${limit}`;

    try {
        // Handle pagination for complete results
        let allNfts: any[] = [];
        let hasMore = true;

        while (hasMore) {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Mirror node error: ${response.status}`);
            }

            const data = await response.json();
            const nfts = data.nfts || [];
            allNfts = [...allNfts, ...nfts];

            // Check for more pages
            const nextLink = data.links?.next;
            if (nextLink) {
                url = `${baseUrl}${nextLink}`;
            } else {
                hasMore = false;
            }
        }

        if (!allNfts.length) {
            return null; // No license NFTs found
        }

        // Get the first license NFT (could be extended to handle multiple licenses)
        const license = allNfts[0];

        let topicId;
        try {
            // Try to decode the metadata as base64
            topicId = Buffer.from(license.metadata, 'base64').toString();
            // Validate if it's a valid topicId format
            TopicId.fromString(topicId); // Will throw if invalid
        } catch (e) {
            console.error('Failed to decode license metadata:', e);
            return {
                tokenId: license.token_id,
                serialNumber: license.serial_number,
                ownerId: accountId,
                valid: false,
                error: 'Invalid license metadata'
            };
        }

        // Get messages from the topic to verify license details
        const messages = await getTopicMessages(topicId);

        // Find the license creation message (should be first message)
        const creationMessage = messages.find(msg =>
            msg.content && msg.content.type === 'LICENSE_CREATION'
        );

        // Extract metadata from creation message if available
        const metadata = creationMessage?.content?.metadata || {
            type: "LICENSE",
            name: "License NFT",
            description: "Hedera License NFT"
        };

        return {
            tokenId: license.token_id,
            serialNumber: license.serial_number,
            topicId,
            metadata,
            ownerId: accountId,
        };
    } catch (e) {
        console.error('Error fetching license details:', e);
        return {
            tokenId: process.env.LICENSE_TOKEN_ID,
            ownerId: accountId,
            valid: false,
            error: e instanceof Error ? e.message : 'Unknown error'
        };
    }
}

export const mintLicenseToken = async (tokenId: string, topicId: string): Promise<number> => {
    try {
        const client = getClient();
        const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY!);

        // Create topicId metadata bytes - this is used to link the NFT to its topic
        const metadataBytes = Buffer.from(topicId);

        // Mint the NFT with the topicId as metadata
        const transaction = new TokenMintTransaction()
            .setTokenId(TokenId.fromString(tokenId))
            .setMetadata([metadataBytes])
            .freezeWith(client);

        const signedTx = await transaction.sign(operatorKey);
        const txResponse = await signedTx.execute(client);
        const receipt = await txResponse.getReceipt(client);

        const serialNumber = receipt.serials![0].toNumber();
        console.log(`Minted NFT with serial number: ${serialNumber}`);

        return serialNumber;
    } catch (error) {
        console.error('Error minting token:', error);
        throw error;
    }
}

export const recordLicenseCreationMessage = async (
    topicId: string,
    tokenId: string,
    serialNumber: number,
    metadata: NftMetadata
): Promise<string> => {
    try {
        const client = getClient();
        const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY!);

        // Create a message that documents the license creation
        const message = {
            type: 'LICENSE_CREATION',
            tokenId,
            serialNumber,
            metadata,
            timestamp: new Date().toISOString()
        };

        // Convert the message to a string and then to bytes
        const messageBytes = Buffer.from(JSON.stringify(message));

        // Submit the message to the topic
        const transaction = await new TopicMessageSubmitTransaction()
            .setTopicId(TopicId.fromString(topicId))
            .setMessage(messageBytes)
            .freezeWith(client);

        const signedTx = await transaction.sign(operatorKey);
        const txResponse = await signedTx.execute(client);
        const receipt = await txResponse.getReceipt(client);

        // Get the message timestamp
        const messageTimestamp = new Date().toISOString();
        console.log(`Recorded message to topic ${topicId} at ${messageTimestamp}`);

        return messageTimestamp;
    } catch (error) {
        console.error('Error recording message:', error);
        throw error;
    }
}

export const transferLicense = async (tokenId: string, serialNumber: number, recipientId: string) => {
    try {
        const client = getClient();
        const operatorId = getOperatorId();
        const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY!);

        if (!operatorId || !operatorKey) {
            throw new Error('Operator ID or key is not set');
        }
        
        // Create a transfer transaction
        const transaction = new TransferTransaction()
            .addNftTransfer(
                TokenId.fromString(tokenId),
                serialNumber,
                AccountId.fromString(operatorId),
                AccountId.fromString(recipientId)
            )
            .freezeWith(client);

        // Sign the transaction with the operator key
        const signedTx = await transaction.sign(operatorKey);
        const txResponse = await signedTx.execute(client);
        const receipt = await txResponse.getReceipt(client);

        return {
            status: receipt.status.toString(),
            tokenId,
            serialNumber,
            from: operatorId,
            to: recipientId,
            transactionId: txResponse.transactionId.toString()
        };
    } catch (error) {
        console.error('Error transferring license:', error);
        throw error;
    }
}

export const transferHsuiteToken = async (tokenId: string, accountId: string) => {
    try {
        const client = getClient();
        const operatorId = getOperatorId();
        const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY!);

        if (!operatorId || !operatorKey) {
            throw new Error('Operator ID or key is not set');
        }

        // Create a transfer transaction
        const transaction = new TransferTransaction()
            .addTokenTransfer( TokenId.fromString(tokenId), AccountId.fromString(accountId), 2000000 )
            .addTokenTransfer( TokenId.fromString(tokenId), AccountId.fromString(operatorId), -2000000 )
            .freezeWith(client);

        // Sign the transaction with the operator key
        const signedTx = await transaction.sign(operatorKey);
        const txResponse = await signedTx.execute(client);
        const receipt = await txResponse.getReceipt(client);

        return {
            status: receipt.status.toString(),
            tokenId,
            accountId,
            transactionId: txResponse.transactionId.toString()
        };
    } catch (error) {
        console.error('Error transferring HSUITE token:', error);
        throw error;
    }
}