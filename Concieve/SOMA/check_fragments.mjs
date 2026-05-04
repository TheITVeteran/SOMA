import { FragmentRegistry } from './arbiters/FragmentRegistry.js';

async function test() {
    const fr = new FragmentRegistry();
    await fr.initialize();
    console.log(`Loaded fragments: ${fr.fragments.size}`);
    console.log(`Active fragments: ${fr.stats.activeFragments}`);
    
    const list = fr.listFragments();
    console.log(`First 5 labels: ${list.slice(0, 5).map(f => f.label).join(', ')}`);
}

test();
