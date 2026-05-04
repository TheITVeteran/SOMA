import { FragmentRegistry } from './arbiters/FragmentRegistry.js';

async function test() {
    const fr = new FragmentRegistry();
    await fr.initialize();
    
    const it = fr.fragments.values();
    for (let i = 0; i < 5; i++) {
        const f = it.next().value;
        console.log(`Fragment ${i}: ID=${f.id}, Label=${f.label}, Active=${f.active}`);
    }
}

test();
