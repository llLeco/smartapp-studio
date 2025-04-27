// frontend/services/index.ts
import * as licenseService from './licenseService';
import * as subscriptionService from './subscriptionService';
import * as hederaService from './hederaService';
import * as topicService from './topicService';
import * as projectService from './projectService';
import * as chatService from './chatService';

export {
  licenseService,
  subscriptionService,
  hederaService,
  topicService,
  projectService,
  chatService
};

// Export default as an object with all services
export default {
  license: licenseService,
  subscription: subscriptionService,
  hedera: hederaService,
  topic: topicService,
  project: projectService,
  chat: chatService
}; 