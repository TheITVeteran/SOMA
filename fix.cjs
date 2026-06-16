const fs = require('fs');
const files = [
  'C:/Users/barry/Desktop/The Stack/SOMA/server/api/gameTheoryRoutes.js',
  'C:/Users/barry/Desktop/The Stack/SOMA/arbiters/GameTheoryArbiter.js',
  'C:/Users/barry/Desktop/The Stack/SOMA/server/api/macroEventRoutes.js',
  'C:/Users/barry/Desktop/The Stack/SOMA/arbiters/MacroEventArbiter.js',
  'C:/Users/barry/Desktop/The Stack/SOMA/adapters/BraveSearchAdapter.js'
];

for (let file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Revert the bad replacement
  content = content.replace(/import UniversalLearningPipeline from '..\/pipelines\/UniversalLearningPipeline';, null, 2\)\);/g, "import UniversalLearningPipeline from '../pipelines/UniversalLearningPipeline.js';");
  
  // Fix imports missing .js extensions (Node requires .js in ESM)
  content = content.replace(/import gameTheoryArbiter from '\.\.\/\.\.\/arbiters\/GameTheoryArbiter';/g, "import gameTheoryArbiter from '../../arbiters/GameTheoryArbiter.js';");
  content = content.replace(/import macroEventArbiter from '\.\.\/\.\.\/arbiters\/MacroEventArbiter';/g, "import macroEventArbiter from '../../arbiters/MacroEventArbiter.js';");
  content = content.replace(/import BraveSearchAdapter from '\.\.\/adapters\/BraveSearchAdapter';/g, "import BraveSearchAdapter from '../adapters/BraveSearchAdapter.js';");
  
  fs.writeFileSync(file, content);
}
