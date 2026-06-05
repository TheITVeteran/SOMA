import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const MessageBroker = require('../core/MessageBroker.cjs');

console.log('Testing MessageBroker lookup for SomaBrain, QuadBrain, and SOMArbiter...');

const broker = MessageBroker;
console.log('Registered arbiters in message broker:', Array.from(broker.arbiters.keys()));

const brain = broker.findArbiter('SomaBrain', { exact: false });
console.log('Lookup SomaBrain:', brain.found ? 'FOUND' : 'NOT FOUND');

const quad = broker.findArbiter('QuadBrain', { exact: false });
console.log('Lookup QuadBrain:', quad.found ? 'FOUND' : 'NOT FOUND');

const soma = broker.findArbiter('SOMArbiter', { exact: false });
console.log('Lookup SOMArbiter:', soma.found ? 'FOUND' : 'NOT FOUND');
