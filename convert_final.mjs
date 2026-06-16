import fs from 'fs';

const files = [
  'C:/Users/barry/Desktop/The Stack/SOMA/server/api/gameTheoryRoutes.js',
  'C:/Users/barry/Desktop/The Stack/SOMA/server/api/macroEventRoutes.js',
  'C:/Users/barry/Desktop/The Stack/SOMA/arbiters/GameTheoryArbiter.js',
  'C:/Users/barry/Desktop/The Stack/SOMA/arbiters/MacroEventArbiter.js',
  'C:/Users/barry/Desktop/The Stack/SOMA/adapters/BraveSearchAdapter.js'
];

fs.copyFileSync('C:/Users/barry/OneDrive/Desktop/The Stack/SOMA/server/api/gameTheoryRoutes.js', 'C:/Users/barry/Desktop/The Stack/SOMA/server/api/gameTheoryRoutes.js');
fs.copyFileSync('C:/Users/barry/OneDrive/Desktop/The Stack/SOMA/server/api/macroEventRoutes.js', 'C:/Users/barry/Desktop/The Stack/SOMA/server/api/macroEventRoutes.js');
fs.copyFileSync('C:/Users/barry/OneDrive/Desktop/The Stack/SOMA/arbiters/GameTheoryArbiter.js', 'C:/Users/barry/Desktop/The Stack/SOMA/arbiters/GameTheoryArbiter.js');
fs.copyFileSync('C:/Users/barry/OneDrive/Desktop/The Stack/SOMA/arbiters/MacroEventArbiter.js', 'C:/Users/barry/Desktop/The Stack/SOMA/arbiters/MacroEventArbiter.js');
fs.copyFileSync('C:/Users/barry/OneDrive/Desktop/The Stack/SOMA/adapters/BraveSearchAdapter.js', 'C:/Users/barry/Desktop/The Stack/SOMA/adapters/BraveSearchAdapter.js');

for (let file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Convert const x = require('y') to import x from 'y'
  content = content.replace(/const\s+([A-Za-z0-9_]+)\s*=\s*require\('([^']+)'\);/g, (match, varName, reqPath) => {
    // If it's a relative import, ensure it ends with .js
    if (reqPath.startsWith('.')) {
      if (!reqPath.endsWith('.js')) {
        reqPath += '.js';
      }
    }
    return import  from '';;
  });

  // Export default
  content = content.replace(/module\.exports\s*=\s*([A-Za-z0-9_]+);/g, "export default ;");

  // Fix UniversalLearningPipeline block
  content = content.replace(
    /let UniversalLearningPipeline;[\s\S]*?try\s*\{[\s\S]*?\}\s*catch\s*\(e\)\s*\{[\s\S]*?\}/, 
    "import UniversalLearningPipeline from '../pipelines/UniversalLearningPipeline.js';"
  );

  // Add __dirname polyfill if missing
  if (content.includes('__dirname') && !content.includes('fileURLToPath')) {
    content = "import { fileURLToPath } from 'url';\nimport { dirname } from 'path';\nconst __filename = fileURLToPath(import.meta.url);\nconst __dirname = dirname(__filename);\n" + content;
  }

  // Final sanity check for UniversalLearningPipeline if it's imported at the top, ensuring .js
  content = content.replace(/from '\.\.\/pipelines\/UniversalLearningPipeline'/g, "from '../pipelines/UniversalLearningPipeline.js'");

  fs.writeFileSync(file, content);
}
