const fs = require('fs');
const path = require('path');

const BASE_DIR = process.cwd();
const LEARNING_DIR = path.join(BASE_DIR, 'SOMA', 'simulation-learning');
const WORLD_MODEL_DIR = path.join(BASE_DIR, 'SOMA', 'world-model');
const Q_TABLE_FILE = path.join(LEARNING_DIR, 'q-learning-state.json');
const WORLD_MODEL_FILE = path.join(WORLD_MODEL_DIR, 'transitions.json');

function analyzeQTable() {
    console.log('--- DIAGNOSTIC: Q-Learning State ---');
    if (!fs.existsSync(Q_TABLE_FILE)) {
        console.log('❌ Q-Learning state file NOT found.');
        return;
    }

    try {
        const stats = fs.statSync(Q_TABLE_FILE);
        console.log(`✅ File exists. Size: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`🕒 Last Modified: ${stats.mtime.toISOString()}`);

        const data = JSON.parse(fs.readFileSync(Q_TABLE_FILE, 'utf8'));
        
        // Q-Table is saved as an array of entries [key, values]
        const qTable = data.qTable; 
        const totalStates = qTable.length;
        
        console.log(`📊 Total Learned States: ${totalStates}`);
        
        if (totalStates === 0) {
            console.log('⚠️  Q-Table is empty. No learning has been recorded.');
            return;
        }

        let nonZeroStates = 0;
        let maxQ = -Infinity;
        let minQ = Infinity;
        let totalQ = 0;
        let countQ = 0;

        // Analyze values
        for (const [key, values] of qTable) {
            const hasNonZero = values.some(v => v !== 0);
            if (hasNonZero) nonZeroStates++;
            
            for (const val of values) {
                if (val > maxQ) maxQ = val;
                if (val < minQ) minQ = val;
                totalQ += Math.abs(val); // Magnitude of learning
                countQ++;
            }
        }

        console.log(`🧠 States with non-zero values: ${nonZeroStates} (${((nonZeroStates/totalStates)*100).toFixed(1)}%)`);
        console.log(`📈 Max Q-Value: ${maxQ.toFixed(4)}`);
        console.log(`📉 Min Q-Value: ${minQ.toFixed(4)}`);
        console.log(`📉 Avg Q-Magnitude: ${(totalQ/countQ).toFixed(4)}`);

        if (nonZeroStates === 0) {
            console.log('❌ CRITICAL: All Q-values are zero. Learning update step is failing or reward is always 0.');
        } else if (nonZeroStates < 10) {
            console.log('⚠️  WARNING: Very few states have been learned. Exploration might be stuck.');
        } else {
            console.log('✅ Learning signatures detected.');
        }
        
        if (data.stats) {
            console.log('\n--- Internal Stats ---');
            console.log(`Episodes: ${data.stats.episodesCompleted}`);
            console.log(`Successes: ${data.stats.successfulEpisodes}`);
            console.log(`Avg Reward: ${data.stats.averageReward}`);
            console.log(`Exploration Rate (ε): ${data.stats.explorationRate}`);
        }

    } catch (error) {
        console.error('❌ Error reading Q-Table:', error.message);
    }
}

function analyzeWorldModel() {
    console.log('\n--- DIAGNOSTIC: World Model (AGI) ---');
    if (!fs.existsSync(WORLD_MODEL_FILE)) {
        console.log('⚠️  World Model file NOT found (Normal if new).');
        return;
    }

    try {
        const stats = fs.statSync(WORLD_MODEL_FILE);
        console.log(`✅ File exists. Size: ${(stats.size / 1024).toFixed(2)} KB`);
        
        const data = JSON.parse(fs.readFileSync(WORLD_MODEL_FILE, 'utf8'));
        
        // Transitions: array of [key, value]
        const transitions = data.transitions || [];
        console.log(`🌍 Modeled Transitions: ${transitions.length}`);

        if (transitions.length > 0) {
            // Check confidence/observations
            let totalObs = 0;
            for (const [key, model] of transitions) {
                totalObs += model.observations;
            }
            console.log(`👀 Total Observations: ${totalObs}`);
            console.log(`📊 Avg Observations per State: ${(totalObs/transitions.length).toFixed(1)}`);
        }

    } catch (error) {
        console.error('❌ Error reading World Model:', error.message);
    }
}

console.log('🔍 STARTING DIAGNOSTIC RUN...\n');
analyzeQTable();
analyzeWorldModel();
console.log('\n🔍 DIAGNOSTIC COMPLETE');
