const UniversalImpulser = require('./arbiters/UniversalImpulser.cjs');

async function run() {
    const impulser = new UniversalImpulser({ type: 'test' });
    await impulser.initialize();
    console.log("Testing storeInHippocampus buffer...");
    
    // Push 60 items rapidly to trigger the batch flush
    const promises = [];
    for(let i=0; i<60; i++) {
        promises.push(impulser.storeInHippocampus({ test: true, index: i }));
    }
    
    await Promise.all(promises);
    console.log("Buffer length after 60 rapid pushes (should be <= 10 due to flush threshold of 50):", impulser._hippocampusBuffer.length);
    
    // Force final flush
    await impulser._flushHippocampusBuffer();
    console.log("Buffer length after forced flush:", impulser._hippocampusBuffer.length);
    console.log("Test complete.");
}

run();
