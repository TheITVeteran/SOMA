import { KnowledgeGraphFusion } from './arbiters/KnowledgeGraphFusion.js';
import path from 'path';

async function test() {
    const kg = new KnowledgeGraphFusion({
        savePath: path.join(process.cwd(), 'SOMA', 'soma-knowledge.json')
    });
    await kg.initialize();
    console.log(`Nodes: ${kg.nodes.size}`);
    console.log(`Edges: ${kg.edges.size}`);
}

test();
