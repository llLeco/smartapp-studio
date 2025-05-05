import { PrivateKey, TopicCreateTransaction } from "@hashgraph/sdk";
import { getMirrorNodeUrl, getClient } from "./hederaService.js";
import { NftMetadata } from "./licenseService.js";

export interface Message {
    consensusTimestamp: string;
    topicSequenceNumber: string;
    content: any;
    type: 'USAGE' | 'UPGRADE' | 'CHAT_TOPIC' | 'OTHER';
  }

export const getTopicMessages = async (topicId: string): Promise<Message[]> => {
    const url = `${getMirrorNodeUrl()}/api/v1/topics/${topicId}/messages?limit=100`;
    const response = await fetch(url);
    const data = await response.json();
  
    return (data.messages || []).map((msg: any) => {
      let content: any;
      try {
        content = JSON.parse(Buffer.from(msg.message, 'base64').toString());
      } catch {
        content = {};
      }
      return {
        consensusTimestamp: msg.consensus_timestamp,
        topicSequenceNumber: msg.sequence_number,
        content,
        type: content.type || 'OTHER'
      };
    });
  };

  export const createTopic = async (metadata: NftMetadata): Promise<string> => {
    try {
      const client = getClient();
      const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY!);
      
      // Create a new topic with memo containing license metadata
      const metadataStr = JSON.stringify({ type: 'LICENSE_METADATA', metadata });
      const transaction = new TopicCreateTransaction()
        .setAdminKey(operatorKey)
        .setSubmitKey(operatorKey)
        .setTopicMemo("License Main Topic - " + metadata.creator)
        .freezeWith(client);
      
      const signedTx = await transaction.sign(operatorKey);
      const txResponse = await signedTx.execute(client);
      const receipt = await txResponse.getReceipt(client);
      
      const topicId = receipt.topicId!.toString();
      console.log(`Created topic with ID: ${topicId}`);
      
      return topicId;
    } catch (error) {
      console.error('Error creating topic:', error);
      throw error;
    }
  }