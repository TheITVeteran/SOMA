const fs = require('fs');
const data = JSON.parse(fs.readFileSync('asi/tests/validation-results.json', 'utf8'));

data.results.forEach(p => {
    console.log(`Problem: ${p.name}`);
    if (p.tree && p.tree.children) {
        p.tree.children.forEach(c => {
            console.log(`  Node: ${c.id}`);
            console.log(`    Sandbox: ${c.evaluation?.deterministic}`);
            console.log(`    Critic: ${c.evaluation?.llmCritique}`);
        });
    }
});
