import fs from 'fs';

const files = [
  'C:/Users/barry/Desktop/The Stack/SOMA/server/api/gameTheoryRoutes.js',
  'C:/Users/barry/Desktop/The Stack/SOMA/server/api/macroEventRoutes.js',
  'C:/Users/barry/Desktop/The Stack/SOMA/arbiters/GameTheoryArbiter.js',
  'C:/Users/barry/Desktop/The Stack/SOMA/arbiters/MacroEventArbiter.js',
  'C:/Users/barry/Desktop/The Stack/SOMA/adapters/BraveSearchAdapter.js'
];

// Copy pristine versions from OneDrive
fs.copyFileSync('C:/Users/barry/OneDrive/Desktop/The Stack/SOMA/server/api/gameTheoryRoutes.js', 'C:/Users/barry/Desktop/The Stack/SOMA/server/api/gameTheoryRoutes.js');
fs.copyFileSync('C:/Users/barry/OneDrive/Desktop/The Stack/SOMA/server/api/macroEventRoutes.js', 'C:/Users/barry/Desktop/The Stack/SOMA/server/api/macroEventRoutes.js');
fs.copyFileSync('C:/Users/barry/OneDrive/Desktop/The Stack/SOMA/arbiters/GameTheoryArbiter.js', 'C:/Users/barry/Desktop/The Stack/SOMA/arbiters/GameTheoryArbiter.js');
fs.copyFileSync('C:/Users/barry/OneDrive/Desktop/The Stack/SOMA/arbiters/MacroEventArbiter.js', 'C:/Users/barry/Desktop/The Stack/SOMA/arbiters/MacroEventArbiter.js');
fs.copyFileSync('C:/Users/barry/OneDrive/Desktop/The Stack/SOMA/adapters/BraveSearchAdapter.js', 'C:/Users/barry/Desktop/The Stack/SOMA/adapters/BraveSearchAdapter.js');

for (let file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Convert requires
  content = content.replace(/const\s+([A-Za-z0-9_]+)\s*=\s*require\((.*?)\);/g, "import $1 from $2.js';");
  // Fix native requires that don't need .js
  content = content.replace(/import express from 'express.js';/g, "import express from 'express';");
  content = content.replace(/import path from 'path.js';/g, "import path from 'path';");
  content = content.replace(/import fs from 'fs.js';/g, "import fs from 'fs';");
  content = content.replace(/import path from 'node:path.js';/g, "import path from 'node:path';");
  content = content.replace(/import url from 'url.js';/g, "import url from 'url';");

  // Fix module.exports
  content = content.replace(/module\.exports\s*=\s*([A-Za-z0-9_]+);/g, "export default $1;");

  // Fix try/catch require for UniversalLearningPipeline
  content = content.replace(
    /let UniversalLearningPipeline;[\s\S]*?try\s*\{[\s\S]*?\}\s*catch\s*\(e\)\s*\{[\s\S]*?\}/, 
    "import UniversalLearningPipeline from './UniversalLearningPipeline.js';"
  );
  // In adapters and routes, the path to UniversalLearningPipeline might be different, but they don't import it.

  // Add __dirname polyfill
  if (content.includes('__dirname')) {
    content = "import { fileURLToPath } from 'url';\nimport { dirname } from 'path';\nconst __filename = fileURLToPath(import.meta.url);\nconst __dirname = dirname(__filename);\n" + content;
  }

  // Double check missing .js for arbiters
  content = content.replace(/import gameTheoryArbiter from '\.\.\/\.\.\/arbiters\/GameTheoryArbiter';/g, "import gameTheoryArbiter from '../../arbiters/GameTheoryArbiter.js';");
  content = content.replace(/import macroEventArbiter from '\.\.\/\.\.\/arbiters\/MacroEventArbiter';/g, "import macroEventArbiter from '../../arbiters/MacroEventArbiter.js';");

  fs.writeFileSync(file, content);
}
