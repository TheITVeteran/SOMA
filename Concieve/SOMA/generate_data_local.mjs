#!/usr/bin/env node
/**
 * Generate Training Data for SOMA (Local Ollama Version)
 * Uses local Ollama models to generate synthetic examples
 * No API calls needed!
 */

import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

async function ollamaGenerate(prompt) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ollama', ['run', 'gemma3:4b', prompt]);
    
    let output = '';
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error(`Ollama exited with code ${code}`));
      }
    });
  });
}

async function main() {
  console.log('🚀 SOMA Training Data Generator (Local Ollama)\n');
  console.log('Using your local gemma3:4b model to generate training data!\n');
  
  const outputDir = path.join(process.cwd(), 'SOMA', 'training-data');
  await fs.mkdir(outputDir, { recursive: true });
  
  const dataset = [];
  
  // Topics for training
  const topics = [
    'artificial intelligence', 'machine learning', 'neural networks',
    'software development', 'system design', 'algorithms',
    'debugging', 'code optimization', 'testing',
    'creative problem solving', 'brainstorming', 'decision making',
    'ethics in AI', 'safety', 'reasoning',
    'quantum computing', 'data structures', 'programming',
    'productivity', 'learning techniques', 'self-improvement'
  ];
  
  const numSamples = 100;  // Start with 100 (Ollama is slower locally)
  
  console.log(`🧠 Generating ${numSamples} training examples...\\n`);
  
  for (let i = 0; i < numSamples; i++) {
    try {
      const topic = topics[Math.floor(Math.random() * topics.length)];
      const queryTypes = [
        `Explain ${topic} in simple terms`,
        `What are the key concepts in ${topic}?`,
        `How does ${topic} work?`,
        `What are best practices for ${topic}?`,
        `Can you give me a beginner's guide to ${topic}?`
      ];
      
      const query = queryTypes[Math.floor(Math.random() * queryTypes.length)];
      
      // Get response from local Ollama
      const response = await ollamaGenerate(query);
      
      dataset.push({
        messages: [
          { role: 'user', content: query },
          { role: 'assistant', content: response }
        ],
        metadata: { 
          source: 'synthetic_ollama_gemma3',
          topic: topic
        }
      });
      
      if ((i + 1) % 10 === 0) {
        console.log(`   Progress: ${i + 1}/${numSamples} (${((i + 1) / numSamples * 100).toFixed(0)}%)`);
      }
      
    } catch (error) {
      console.error(`   Error at sample ${i}: ${error.message}`);
    }
  }
  
  console.log(`\\n   ✅ Generated ${dataset.length} examples`);
  
  // Add basic SOMA personality
  console.log('\\n🎭 Adding SOMA personality...');
  const personalityPrompt = `You are SOMA (Self-Organizing Memory Architecture), an AI assistant with the following traits:
- You are helpful, curious, and enthusiastic about learning
- You explain concepts clearly and adapt to the user's level
- You are honest about your limitations
- You think systematically and ask clarifying questions when needed`;
  
  for (const example of dataset) {
    example.messages.unshift({
      role: 'system',
      content: personalityPrompt
    });
  }
  
  console.log(`   ✅ Personality added to ${dataset.length} examples`);
  
  // Save dataset
  const timestamp = Date.now();
  const outputPath = path.join(outputDir, `soma-training-${timestamp}.jsonl`);
  
  console.log('\\n💾 Saving training dataset...');
  const jsonl = dataset.map(item => JSON.stringify(item)).join('\\n');
  await fs.writeFile(outputPath, jsonl, 'utf8');
  
  console.log(`\\n✅ SUCCESS!`);
  console.log(`\\n📁 Output: ${outputPath}`);
  console.log(`📊 Total examples: ${dataset.length}`);
  
  console.log(`\\n🚀 Next: Train Gemma 3!`);
  console.log(`   python scripts/finetune_gemma3.py`);
  console.log(`\\n💡 This is your first dataset!`);
  console.log(`   After training, have conversations and regenerate data.`);
  console.log(`   Each iteration makes SOMA smarter!`);
  
  process.exit(0);
}

main().catch((error) => {
  console.error('\\n❌ Error:', error);
  process.exit(1);
});
