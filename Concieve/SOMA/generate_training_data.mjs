#!/usr/bin/env node
/**
 * Generate Training Data for SOMA
 * Uses QuadBrain to generate synthetic examples + exports existing conversations
 */

import { SomaBootstrap } from './core/SomaBootstrap.js';
import { CONFIG } from './core/SomaConfig.js';
import { promises as fs } from 'fs';
import path from 'path';

async function main() {
  console.log('🚀 SOMA Training Data Generator\n');
  console.log('Loading SOMA systems...');
  
  const bootstrap = new SomaBootstrap(process.cwd(), CONFIG);
  const system = await bootstrap.initialize();
  
  console.log('\n✅ SOMA loaded! Starting data generation...\n');
  
  // Prepare output
  const outputDir = path.join(process.cwd(), 'SOMA', 'training-data');
  await fs.mkdir(outputDir, { recursive: true });
  
  const dataset = [];
  
  // 1. Export existing conversations (if any)
  if (system.conversationHistory) {
    console.log('📚 Exporting existing conversations...');
    try {
      const sessions = system.conversationHistory.getAllSessions(100);
      let convCount = 0;
      
      for (const session of sessions) {
        const messages = system.conversationHistory.getSessionMessages(session.id);
        
        for (let i = 0; i < messages.length - 1; i++) {
          if (messages[i].role === 'user' && messages[i + 1].role === 'assistant') {
            dataset.push({
              messages: [
                { role: 'user', content: messages[i].content },
                { role: 'assistant', content: messages[i + 1].content }
              ],
              metadata: { source: 'conversation', session: session.id }
            });
            convCount++;
          }
        }
      }
      
      console.log(`   ✅ Exported ${convCount} conversation examples`);
    } catch (error) {
      console.log(`   ⚠️  No conversations yet: ${error.message}`);
    }
  }
  
  // 2. Generate synthetic examples from QuadBrain
  console.log('\n🧠 Generating synthetic training data from QuadBrain...');
  console.log('   (This uses Gemini 2.0 to create training examples)\n');
  
  const topics = [
    'artificial intelligence', 'machine learning', 'quantum computing',
    'software development', 'system design', 'algorithms',
    'debugging', 'code review', 'testing',
    'creative writing', 'brainstorming', 'problem solving',
    'planning', 'strategy', 'decision making',
    'ethics', 'safety', 'reasoning',
    'mathematics', 'physics', 'philosophy',
    'self-improvement', 'learning techniques', 'productivity'
  ];
  
  const numSamples = 500;  // Start with 500 synthetic examples
  
  for (let i = 0; i < numSamples; i++) {
    try {
      const topic = topics[Math.floor(Math.random() * topics.length)];
      const queries = [
        `Explain ${topic} in simple terms`,
        `What are the key concepts in ${topic}?`,
        `How does ${topic} work?`,
        `What are best practices for ${topic}?`,
        `Can you help me understand ${topic}?`
      ];
      
      const query = queries[Math.floor(Math.random() * queries.length)];
      
      // Get response from QuadBrain
      const response = await system.quadBrain.reason(query, 'balanced');
      
      dataset.push({
        messages: [
          { role: 'user', content: query },
          { role: 'assistant', content: response.response }
        ],
        metadata: { 
          source: 'synthetic_quadbrain', 
          brain: response.brain,
          topic: topic
        }
      });
      
      if ((i + 1) % 50 === 0) {
        console.log(`   Progress: ${i + 1}/${numSamples} (${((i + 1) / numSamples * 100).toFixed(0)}%)`);
      }
      
      // Rate limit to avoid API throttling
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`   Error at sample ${i}: ${error.message}`);
    }
  }
  
  console.log(`\n   ✅ Generated ${dataset.filter(d => d.metadata.source === 'synthetic_quadbrain').length} synthetic examples`);
  
  // 3. Add personality system prompt to all examples
  if (system.personalityForge) {
    console.log('\n🎭 Adding SOMA personality to training data...');
    const personalityPrompt = system.personalityForge.generatePersonalityPrompt();
    
    for (const example of dataset) {
      example.messages.unshift({
        role: 'system',
        content: personalityPrompt
      });
    }
    
    console.log(`   ✅ Personality injected into ${dataset.length} examples`);
  }
  
  // 4. Save dataset
  const timestamp = Date.now();
  const outputPath = path.join(outputDir, `soma-training-${timestamp}.jsonl`);
  
  console.log('\n💾 Saving training dataset...');
  const jsonl = dataset.map(item => JSON.stringify(item)).join('\n');
  await fs.writeFile(outputPath, jsonl, 'utf8');
  
  console.log(`\n✅ SUCCESS! Training data generated!`);
  console.log(`\n📁 Output: ${outputPath}`);
  console.log(`📊 Total examples: ${dataset.length}`);
  console.log(`   - Conversations: ${dataset.filter(d => d.metadata.source === 'conversation').length}`);
  console.log(`   - Synthetic (QuadBrain): ${dataset.filter(d => d.metadata.source === 'synthetic_quadbrain').length}`);
  
  console.log(`\n🚀 Next step: Train Gemma 3!`);
  console.log(`   python scripts/finetune_gemma3.py`);
  console.log(`\n💡 Tips:`);
  console.log(`   - This is your FIRST dataset (${dataset.length} examples)`);
  console.log(`   - After training, have more conversations with SOMA`);
  console.log(`   - Re-run this script to get new data`);
  console.log(`   - Each re-training makes SOMA smarter!`);
  
  process.exit(0);
}

main().catch((error) => {
  console.error('\n❌ Error:', error);
  console.error(error.stack);
  process.exit(1);
});
