import { FileSystemNode, FileMetadata } from "../types";

export const createMockFileSystem = (): FileSystemNode => {
  // Helper to create nodes
  const createNode = (name: string, kind: 'file' | 'directory', parentId: string | null, pathPrefix: string, content?: string, precalcMetadata?: {summary: string, keywords: string[]}): FileSystemNode => {
    const path = `${pathPrefix}/${name}`;
    const id = `mock_${Math.abs(path.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0))}`;
    
    const metadata: FileMetadata | undefined = kind === 'file' ? {
      size: content ? content.length : 0,
      lastModified: Date.now() - Math.floor(Math.random() * 1000000000),
      type: 'text/plain',
      extension: name.split('.').pop() || '',
      keywords: precalcMetadata?.keywords || [],
      summary: precalcMetadata?.summary || ''
    } : undefined;

    return {
      id,
      name,
      kind,
      path,
      parentId,
      isIndexed: false,
      metadata,
      content,
      children: kind === 'directory' ? [] : undefined
    };
  };

  const rootId = 'root_mock';
  const rootName = 'SOMA_Demo_Drive';
  const rootPath = 'SOMA_Demo_Drive';
  
  const root: FileSystemNode = {
      id: rootId,
      name: rootName,
      kind: 'directory',
      path: rootPath,
      parentId: null,
      isIndexed: false,
      children: []
  };

  // Define structure with pre-calculated AI metadata for instant "Demo" feel
  const structure = [
      { 
        name: 'README.md', 
        content: '# SOMA Project\n\nSOMA is a cognitive file system agent designed to bridge the gap between static files and active intelligence.\n\n## Modules\n1. Cortex (Reasoning)\n2. Hippocampus (Memory)\n3. Broca (Communication)',
        metadata: { summary: 'Project documentation outlining SOMA\'s cognitive architecture modules.', keywords: ['SOMA', 'cognitive', 'architecture', 'cortex', 'hippocampus'] }
      },
      { 
        name: 'package.json', 
        content: '{\n  "name": "soma-core",\n  "version": "2.1.0",\n  "dependencies": {\n    "neural-net": "^4.2.0",\n    "fs-walker": "^1.0.0"\n  }\n}',
        metadata: { summary: 'Project configuration file defining dependencies for soma-core.', keywords: ['configuration', 'npm', 'dependencies', 'soma-core'] }
      },
      { name: 'src', kind: 'directory', children: [
          { 
            name: 'cortex.ts', 
            content: 'import { Memory } from "./hippocampus";\n\nexport class Cortex {\n  process(input: string) {\n    const context = Memory.recall(input);\n    return this.reason(input, context);\n  }\n\n  private reason(input, context) {\n    // Implementation of high-level reasoning loop\n    return `Analyzed: ${input}`;\n  }\n}',
            metadata: { summary: 'Core logic class "Cortex" handling input processing and reasoning loops.', keywords: ['Cortex', 'reasoning', 'class', 'TypeScript', 'logic'] }
          },
          { 
            name: 'hippocampus.ts', 
            content: 'export class Hippocampus {\n  private static storage = new Map<string, any>();\n\n  static recall(key: string) {\n    // Retrieve semantic vectors\n    return this.storage.get(key);\n  }\n\n  static consolidate() {\n    // Move short-term to long-term memory\n    console.log("Consolidating memories...");\n  }\n}',
            metadata: { summary: 'Memory management module "Hippocampus" for storage and recall.', keywords: ['Hippocampus', 'memory', 'storage', 'recall', 'static'] }
          },
          { name: 'modules', kind: 'directory', children: [
              { 
                name: 'decay.ts', 
                content: 'export const applyDecay = (memoryStrength: number, timeDelta: number) => {\n  // Ebbinghaus forgetting curve implementation\n  return memoryStrength * Math.exp(-timeDelta);\n};',
                metadata: { summary: 'Utility function implementing memory decay logic using Ebbinghaus curve.', keywords: ['decay', 'memory', 'math', 'forgetting curve'] }
              },
              { 
                name: 'arbitration.ts', 
                content: 'import { Signal } from "../types";\n\nexport const arbiter = (signals: Signal[]) => {\n  // Winner-take-all arbitration mechanism\n  return signals.sort((a, b) => b.strength - a.strength)[0];\n};',
                metadata: { summary: 'Arbitration logic to select the strongest signal from a set of inputs.', keywords: ['arbitration', 'signal', 'sort', 'winner-take-all'] }
              }
          ]}
      ]},
      { name: 'logs', kind: 'directory', children: [
          { 
            name: 'system.log', 
            content: '[2023-10-01 10:00:00] SYSTEM BOOT\n[2023-10-01 10:00:05] CORTEX ONLINE\n[2023-10-01 10:00:06] HIPPOCAMPUS SYNCED\n[WARN] Memory decay rate exceeding nominal parameters.',
            metadata: { summary: 'System startup logs showing initialization sequence and warnings.', keywords: ['logs', 'boot', 'system', 'warning', 'timestamp'] }
          }
      ]}
  ];

  // Recursively build tree
  const buildTree = (items: any[], parent: FileSystemNode) => {
      items.forEach(item => {
          const kind = item.kind || 'file';
          const node = createNode(item.name, kind, parent.id, parent.path, item.content, item.metadata);
          if (parent.children) parent.children.push(node);
          
          if (item.children) {
              buildTree(item.children, node);
          }
      });
  };

  buildTree(structure, root);

  return root;
};