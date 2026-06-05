const messageBroker = require('../core/MessageBroker.cjs');
const KevinPersonalityEngine = require('../core/KevinPersonalityEngine.cjs');

(async () => {
    console.log('Waiting for registrations...');
    await new Promise(r => setTimeout(r, 4000));
    console.log('REGISTERED ARBITERS:', messageBroker.getRegisteredArbiters().map(a => a.name));
    const kevin = new KevinPersonalityEngine(messageBroker);
    const response = await kevin.respond('hello');
    console.log('KEVIN CHAT RESPONSE:', response);
    process.exit(0);
})();
