import * as pkg from './C:/Users/barry/Desktop/The Stack/SOMA/arbiters/SOMArbiterV3.js';
const { SOMArbiterV3 } = pkg;

const iterations = 1000;
const start = performance.now();

const arbiter = new SOMArbiterV3({ asiEnabled: false });

for (let i = 0; i < iterations; i++) {
  arbiter._deriveWeather();
  arbiter._getRecentLifeBlock();
  arbiter._nudgeLimbic({ dopamine: 0.01, cortisol: -0.005 }, 'benchmark tick');
  arbiter._limbicTick();
}

const end = performance.now();
const latencyMs = (end - start) / iterations;
const memoryBytes = process.memoryUsage().heapUsed;

console.log(JSON.stringify({ latencyMs, memoryBytes }));