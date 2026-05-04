// ═══════════════════════════════════════════════════════════
// FILE: run_path_b.js
// Path B: Deep Reasoning Demo (Simulated ASI Tree Search)
// Demonstrates "System 2" thinking: Generate -> Critique -> Select
// ═══════════════════════════════════════════════════════════

const TreeSearchEngine = require('./asi/core/TreeSearchEngine.cjs');
const SolutionEvaluator = require('./asi/evaluation/SolutionEvaluator.cjs');
const SandboxRunner = require('./asi/execution/SandboxRunner.cjs');

// 🧠 MOCK LLM ADAPTER (Simulates a specialized Quantum AI)
class MockQuantumLLM {
  async generate(prompt) {
    // 1. GENERATE APPROACHES
    if (prompt.includes('Generate 5 different coding approaches')) {
      return JSON.stringify([
        {
          name: "Standard Bell State",
          strategy: "Use Hadamard gate then CNOT gate",
          steps: ["Apply H to qubit 0", "Apply CNOT(0, 1)"],
          strengths: "Standard, efficient, minimal depth",
          weaknesses: "None"
        },
        {
          name: "Double Hadamard",
          strategy: "Apply H to both, then CNOT",
          steps: ["H(0)", "H(1)", "CNOT(0,1)"],
          strengths: "Creates superposition on both",
          weaknesses: "Creates incorrect state (|++> + |-->)"
        },
        {
          name: "X-Basis Bell",
          strategy: "Flip qubit 1, then standard Bell",
          steps: ["X(1)", "H(0)", "CNOT(0,1)"],
          strengths: "Creates |Psi+> state",
          weaknesses: "One extra gate"
        },
        {
          name: "Measurement-Based",
          strategy: "Measure and post-select",
          steps: ["H(0)", "Measure 0", "Apply X to 1 if 0 is 1"],
          strengths: "Demonstrates teleportation principle",
          weaknesses: "Probabilistic, not unitary"
        },
        {
          name: "Swap Test",
          strategy: "Use Fredkin gate",
          steps: ["H(0)", "CSWAP(0, 1, 2)", "H(0)"],
          strengths: "Good for state comparison",
          weaknesses: "Wrong circuit for generation"
        }
      ]);
    }

    // 2. GENERATE SOLUTIONS (Code for each approach)
    if (prompt.includes('Approach: Standard Bell State')) {
      return `
function createBellState(circuit) {
  circuit.h(0);       // Put q0 in superposition
  circuit.cnot(0, 1); // Entangle q0 and q1
  return circuit;
}`;
    }
    if (prompt.includes('Approach: Double Hadamard')) {
      return `
function createBellState(circuit) {
  circuit.h(0);
  circuit.h(1);       // ERROR: Creates superposition on q1 too early
  circuit.cnot(0, 1);
  return circuit;
}`;
    }
    if (prompt.includes('Approach: X-Basis Bell')) {
      return `
function createBellState(circuit) {
  circuit.x(1);       // Start q1 at |1>
  circuit.h(0);
  circuit.cnot(0, 1);
  return circuit;
}`;
    }
    // ... default fallback
    return `// Placeholder solution`;
  }
}

// 🧪 MOCK EVALUATOR (Simulates running a Quantum Simulator)
class QuantumEvaluator extends SolutionEvaluator {
  async evaluate(code, problem) {
    // Simulate scoring based on circuit correctness
    if (code.includes('circuit.h(0)') && code.includes('circuit.cnot(0, 1)') && !code.includes('circuit.h(1)')) {
      return { score: 1.0, grade: 'A+', feedback: 'Perfect Bell State (|Phi+>)' };
    }
    if (code.includes('circuit.x(1)')) {
      return { score: 0.9, grade: 'A-', feedback: 'Valid Bell State (|Psi+>), but not standard |Phi+>' };
    }
    if (code.includes('circuit.h(1)')) {
      return { score: 0.4, grade: 'F', feedback: 'Incorrect state: Product state created, not entangled' };
    }
    return { score: 0.1, grade: 'F', feedback: 'Invalid circuit' };
  }
}

// 🚀 MAIN DEMO
async function main() {
  console.log('🚀 STARTING PATH B: DEEP REASONING DEMO');
  console.log('---------------------------------------');
  console.log('Problem: "Design a Quantum Circuit to create a Bell State (|Phi+>)"');
  console.log('Engine:  SOMA ASI Tree Search (Beam Width: 5)\n');

  // 1. Setup
  const llm = new MockQuantumLLM();
  const evaluator = new QuantumEvaluator({ sandbox: new SandboxRunner() });
  
  const engine = new TreeSearchEngine({
    maxDepth: 2,
    branchingFactor: 5,
    strategy: 'beam',
    evaluator,
    llm,
    useCognitiveDiversity: false, // Disable to use standard prompt for Mock LLM
    logger: {
      info: (msg) => console.log(`[TreeSearch] ${msg}`),
      debug: () => {},
      warn: console.warn,
      error: console.error
    }
  });

  // 2. Run Search
  console.log('🧠 PHASE 1: GENERATING APPROACHES...');
  const problem = "Design a Quantum Circuit to create a Bell State";
  
  const result = await engine.search(problem);

  // 3. Show Results
  console.log('\n🧠 PHASE 2: TREE SEARCH COMPLETE');
  console.log('---------------------------------------');
  
  console.log(`\n🏆 BEST SOLUTION FOUND (Score: ${(result.solution.score * 100).toFixed(0)}%):`);
  console.log(`Approach: ${result.solution.approach}`);
  console.log('\n📜 CODE:');
  console.log(result.solution.solution);
  
  console.log('\n📊 ALTERNATIVES CONSIDERED:');
  result.alternatives.forEach(alt => {
    if (alt.approach !== result.solution.approach) {
       console.log(`- ${alt.approach}: ${(alt.score * 100).toFixed(0)}% (${alt.evaluation.feedback})`);
    }
  });

  console.log('\n✅ CONCLUSION:');
  console.log('SOMA successfully rejected incorrect quantum intuitions ("Double Hadamard")');
  console.log('and converged on the theoretically optimal circuit.');
}

main().catch(console.error);
