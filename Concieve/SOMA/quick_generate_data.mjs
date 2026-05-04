import { SomaBootstrap } from './core/SomaBootstrap.js';
import { CONFIG } from './core/SomaConfig.js';
import fs from 'fs';
import path from 'path';

// Polyfill for __dirname in ESM
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('🚀 SOMA-1T Data Generator Initiated...');
  
  // 1. Initialize System to get QuadBrain
  // We point to current directory
  const bootstrap = new SomaBootstrap(process.cwd(), CONFIG);
  
  console.log('🧠 Initializing QuadBrain connection...');
  // Only initialize what we need (Brain + Memory)
  // We can manually setup if bootstrap is too heavy, but let's try standard init
  // We suppress standard logging to keep console clean for progress bars
  const system = await bootstrap.initialize();
  
  if (!system.quadBrain) {
      console.error('❌ QuadBrain failed to initialize. Check GEMINI_API_KEY.');
      process.exit(1);
  }
  
  // 2. Load the Trainer
  console.log('📚 Loading BootstrapTrainingArbiter...');
  let BootstrapTrainingArbiter;
  try {
      const module = await import('./arbiters/BootstrapTrainingArbiter.js');
      BootstrapTrainingArbiter = module.BootstrapTrainingArbiter;
  } catch (e) {
      console.error('❌ Could not load BootstrapTrainingArbiter:', e);
      process.exit(1);
  }
  
  const trainer = new BootstrapTrainingArbiter({
    name: 'SomaTrainer',
    modelSize: '1B' // Target model size
  });
  
  // 3. Inject Dependencies
  await trainer.initialize({
    metaLearning: system.metaLearning,
    personalityForge: system.personalityForge,
    quadBrain: system.quadBrain,
    mnemonic: system.mnemonic,
    logger: console
  });
  
  // 4. Generate Data
  console.log('\n⚡ STARTING GENERATION (Target: 100 examples)...');
  console.log('   This uses Knowledge Distillation: Gemini 2.0 -> JSONL');
  
  try {
      const result = await trainer.prepareTrainingData({
        distillation: true,
        distillationSamples: 100, 
        augmentation: true,
        outputDir: path.join(process.cwd(), 'SOMA', 'training', 'data')
      });
      
      console.log('\n✅ GENERATION COMPLETE!');
      console.log('----------------------------------------');
      console.log(`📂 File: ${result.finalPath}`);
      console.log(`📊 Training Samples: ${result.trainSize}`);
      console.log(`🧪 Validation Samples: ${result.valSize}`);
      console.log('----------------------------------------');
      console.log('\nNext Step: Run the Python fine-tuning script.');
      
  } catch (err) {
      console.error('\n❌ Generation Failed:', err);
  }
  
  // Cleanup
  process.exit(0);
}

main().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});