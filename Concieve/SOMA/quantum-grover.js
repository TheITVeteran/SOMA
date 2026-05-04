
import {
  createRequire
} from 'module';
const require = createRequire(import.meta.url);
const {
  QuantumSimulationArbiter
} = require('./arbiters/QuantumSimulationArbiter.js');

/**
 * quantum-grover.js
 * 
 * Simulates Grover's Search Algorithm on a 2-qubit system.
 * Demonstrates Amplitude Amplification using SOMA's Quantum Simulator.
 */

async function main() {
  console.log('⚛️  SOMA Quantum Playground: Grover\'s Algorithm');
  console.log('-----------------------------------------------');

  const qSim = new QuantumSimulationArbiter({
    name: 'GroverSimulator'
  });
  await qSim.initialize();

  // 2 Qubits = 4 possible states (|00>, |01>, |10>, |11>)
  // Goal: Find the "Marked" state (we'll mark |11>)
  
  console.log('\n🔍 MISSION: Find the "Marked State" |11> in 1 step.');
  console.log('   (Classical average: 2.25 tries | Quantum: 1 try)');

  /**
   * For a 2-qubit Grover search, the circuit is:
   * 1. H on all qubits (Superposition)
   * 2. Oracle (Flip the phase of the target state |11>)
   * 3. Diffusion Operator (Reflect about the average)
   * 4. Measure
   */

  // Note: Since our current simulator supports H, X, and CNOT, 
  // we will construct the Oracle and Diffusion using these primitive gates.
  
  const gates = [
    // 1. Initial Superposition
    {
      type: 'h',
      targets: [0]
    },
    {
      type: 'h',
      targets: [1]
    },

    // 2. Oracle for |11> 
    // This flips the phase of |11>. In 2-qubits, a Controlled-Z marks |11>.
    // CZ can be made with H + CNOT + H
    {
      type: 'h',
      targets: [1]
    },
    {
      type: 'cnot',
      targets: [0, 1]
    },
    {
      type: 'h',
      targets: [1]
    },

    // 3. Diffusion Operator (Inversion about Mean)
    {
      type: 'h',
      targets: [0]
    },
    {
      type: 'h',
      targets: [1]
    },
    {
      type: 'x',
      targets: [0]
    },
    {
      type: 'x',
      targets: [1]
    },
    // Multi-controlled Z (Oracle for |00>)
    {
      type: 'h',
      targets: [1]
    },
    {
      type: 'cnot',
      targets: [0, 1]
    },
    {
      type: 'h',
      targets: [1]
    },
    {
      type: 'x',
      targets: [0]
    },
    {
      type: 'x',
      targets: [1]
    },
    {
      type: 'h',
      targets: [0]
    },
    {
      type: 'h',
      targets: [1]
    }
  ];

  const trials = 100;
  const counts = {
    '00': 0,
    '01': 0,
    '10': 0,
    '11': 0
  };

  console.log(`\n⏳ Running ${trials} Quantum Searches...`);

  for (let i = 0; i < trials; i++) {
    const result = await qSim.runCircuit(2, gates);
    counts[result.measurement]++;
  }

  console.log('\n📊 FINAL MEASUREMENTS:');
  console.log('-----------------------------------------------');
  Object.entries(counts).forEach(([
    state,
    count
  ]) => {
      const bar = '█'.repeat(Math.round(count / 2));
      const percentage = (count / trials * 100).toFixed(0);
      console.log(`${state}: ${bar} ${percentage}%`);
  });
  console.log('-----------------------------------------------');

  if (counts['11'] > 90) {
      console.log('🚀 QUANTUM SUPREMACY: Target |11> found with >90% probability!');
      console.log('   SOMA has successfully amplified the correct answer.');
  } else {
      console.log('⚠️  INTERFERENCE: The target was not successfully amplified.');
  }

  process.exit(0);
}

main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
