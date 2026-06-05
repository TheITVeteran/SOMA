const messageBroker = require('../core/MessageBroker.cjs');
console.log('messageBroker has request:', typeof messageBroker.request);
console.log('messageBroker has sendMessage:', typeof messageBroker.sendMessage);
process.exit(0);
