import { FragmentRegistry } from './arbiters/FragmentRegistry.js';
import MnemonicArbiter from './arbiters/MnemonicArbiter.js';
import messageBroker from './core/MessageBroker.js';

async function test() {
    const fr = new FragmentRegistry({ messageBroker });
    await fr.initialize();
    
    const ma = new MnemonicArbiter({ messageBroker });
    await ma.initialize();
    
    const fragments = fr.listFragments();
    const memories = ma.getRecentColdMemories(500);
    
    console.log(`Fragments from Registry: ${fragments.length}`);
    console.log(`Memories from Mnemonic: ${memories.length}`);
    console.log(`Total Projected Nodes: ${fragments.length + memories.length}`);
}

test();
