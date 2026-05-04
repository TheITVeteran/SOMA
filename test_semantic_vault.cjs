const SemanticVault = require('./core/SemanticVault.cjs');
const path = require('path');
const fs = require('fs').promises;

async function run() {
    const vaultPath = path.resolve(__dirname, 'data', 'vault', 'reflections');
    await fs.mkdir(vaultPath, { recursive: true });

    // Create a dummy note for testing
    const dummyPath = path.join(vaultPath, 'test_semantic.md');
    await fs.writeFile(dummyPath, '# Test Note\n\nThis is a test note about the UniversalImpulser and RAM spikes. It mentions caching and IO operations.');

    const vault = new SemanticVault(vaultPath);
    console.log("Searching for 'memory buffering'...");
    
    try {
        const results = await vault.search('memory buffering', 5, 0.1);
        console.log('Results:', results);
    } catch (e) {
        console.error('Search failed:', e);
    } finally {
        await fs.unlink(dummyPath).catch(()=>{});
    }
}

run();
