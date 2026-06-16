import fs from 'fs';

const files = [
  'C:/Users/barry/Desktop/The Stack/SOMA/server/api/gameTheoryRoutes.js',
  'C:/Users/barry/Desktop/The Stack/SOMA/server/api/macroEventRoutes.js',
  'C:/Users/barry/Desktop/The Stack/SOMA/arbiters/GameTheoryArbiter.js',
  'C:/Users/barry/Desktop/The Stack/SOMA/arbiters/MacroEventArbiter.js',
  'C:/Users/barry/Desktop/The Stack/SOMA/adapters/BraveSearchAdapter.js'
];

for (let file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Fix the broken .js'
  content = content.replace(/'path'\.js/g, "'path'");
  content = content.replace(/'fs'\.js/g, "'fs'");
  content = content.replace(/'express'\.js/g, "'express'");
  content = content.replace(/'node:path'\.js/g, "'node:path'");
  content = content.replace(/'\.\.\/adapters\/BraveSearchAdapter'\.js/g, "'../adapters/BraveSearchAdapter.js'");
  content = content.replace(/'\.\.\/\.\.\/arbiters\/GameTheoryArbiter'\.js/g, "'../../arbiters/GameTheoryArbiter.js'");
  content = content.replace(/'\.\.\/\.\.\/arbiters\/MacroEventArbiter'\.js/g, "'../../arbiters/MacroEventArbiter.js'");
  
  // Remove duplicate import { fileURLToPath } if it exists from previous script runs
  const match = content.match(/import \{ fileURLToPath \} from 'url';/g);
  if (match && match.length > 1) {
    content = content.replace("import { fileURLToPath } from 'url';\nimport { dirname } from 'path';\nconst __filename = fileURLToPath(import.meta.url);\nconst __dirname = dirname(__filename);\n", "");
  }

  fs.writeFileSync(file, content);
}
