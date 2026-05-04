"""
Self-Learning AI System Demo
Demonstrates the capabilities of the self-learning AI system
"""

import torch
import numpy as np
import matplotlib.pyplot as plt
import time
from typing import Dict, List, Any
import argparse
import json

# Import our system
import sys
sys.path.append('src')

from core.self_learning_system import create_self_learning_system, LearningMode
from interface.dashboard import create_dashboard


def demo_basic_learning():
    """Demonstrate basic learning capabilities"""
    
    print("🧠 Self-Learning AI System Demo")
    print("=" * 50)
    
    # Create system
    print("🚀 Initializing self-learning AI system...")
    system = create_self_learning_system({
        'input_dim': 512,
        'embedding_dim': 512,
        'max_knowledge_nodes': 5000
    })
    
    print(f"✅ System initialized with {system.embedding_dim}D embeddings")
    
    # Demo 1: Knowledge Acquisition
    print("\n📚 Demo 1: Knowledge Acquisition")
    print("-" * 30)
    
    knowledge_items = [
        {"content": "The capital of France is Paris", "type": "geography", "tags": ["france", "capital", "europe"]},
        {"content": "Python is a programming language", "type": "technology", "tags": ["python", "programming", "language"]},
        {"content": "Machine learning uses algorithms to learn patterns", "type": "ai", "tags": ["ml", "algorithms", "patterns"]},
        {"content": "Neural networks are inspired by the brain", "type": "ai", "tags": ["neural", "brain", "networks"]},
        {"content": "Deep learning is a subset of machine learning", "type": "ai", "tags": ["deep", "learning", "subset"]}
    ]
    
    for i, item in enumerate(knowledge_items):
        # Create random embedding for demonstration
        input_data = torch.randn(1, 512)
        
        context = {
            'content': item['content'],
            'node_type': item['type'],
            'semantic_tags': item['tags']
        }
        
        print(f"  📝 Learning: {item['content'][:50]}...")
        results = system(input_data, context=context)
        
        # Show some results
        if 'knowledge_graph' in results and 'new_node_id' in results['knowledge_graph']:
            print(f"     ✅ Added to knowledge graph as {results['knowledge_graph']['new_node_id']}")
    
    # Demo 2: Knowledge Retrieval and Reasoning
    print("\n🔍 Demo 2: Knowledge Retrieval and Reasoning")
    print("-" * 40)
    
    # Query for AI-related knowledge
    query_data = torch.randn(1, 512)
    query_context = {
        'content': 'What do you know about artificial intelligence?',
        'node_type': 'query'
    }
    
    print("  🤔 Query: What do you know about artificial intelligence?")
    results = system(query_data, context=query_context)
    
    if 'knowledge_graph' in results and 'relevant_knowledge' in results['knowledge_graph']:
        relevant = results['knowledge_graph']['relevant_knowledge']
        print(f"  📊 Found {len(relevant)} relevant knowledge items:")
        
        for item in relevant[:3]:  # Show top 3
            content = item.get('content', 'Unknown')
            similarity = item.get('similarity', 0.0)
            print(f"     • {content} (similarity: {similarity:.3f})")
    
    # Demo 3: Adaptive Learning
    print("\n🔄 Demo 3: Adaptive Learning")
    print("-" * 30)
    
    print("  🎯 Training system with sequential patterns...")
    
    # Create a learning task with patterns
    pattern_a = torch.randn(10, 512) + torch.tensor([1.0] * 512)  # Pattern A
    pattern_b = torch.randn(10, 512) + torch.tensor([-1.0] * 512)  # Pattern B
    
    performance_history = []
    
    # Train on pattern A
    system.current_mode = LearningMode.EXPLORATION
    for i, data in enumerate(pattern_a):
        target = data + 0.1 * torch.randn(512)  # Slightly noisy target
        results = system(data.unsqueeze(0), target.unsqueeze(0))
        
        performance = results['performance']['processing_time']
        performance_history.append(performance)
        
        if i % 3 == 0:
            print(f"     Step {i+1}: Processing time = {performance:.4f}s")
    
    # Switch to pattern B
    print("  🔀 Switching to new pattern...")
    system.current_mode = LearningMode.CONSOLIDATION
    
    for i, data in enumerate(pattern_b[:5]):  # Just a few examples
        target = data + 0.1 * torch.randn(512)
        results = system(data.unsqueeze(0), target.unsqueeze(0))
        
        performance = results['performance']['processing_time']
        performance_history.append(performance)
        
        print(f"     New pattern step {i+1}: Processing time = {performance:.4f}s")
    
    # Demo 4: Self-Reflection and Analysis
    print("\n🤔 Demo 4: Self-Reflection and Analysis")
    print("-" * 35)
    
    system_summary = system.get_system_summary()
    
    print("  📊 System Statistics:")
    print(f"     • Learning steps: {system_summary['learning_step']:,}")
    print(f"     • Current mode: {system_summary['current_mode']}")
    print(f"     • Memory items: {system_summary['memory_stats']['long_term_items']:,}")
    print(f"     • Knowledge nodes: {system_summary['knowledge_stats']['num_nodes']:,}")
    print(f"     • Experience count: {system_summary['experience_count']:,}")
    
    print("\n  🎓 Learning Analysis:")
    learning_analysis = system_summary['learning_analysis']
    print(f"     • Progress score: {learning_analysis['progress_score']:.3f}")
    print(f"     • Learning rate: {learning_analysis['learning_rate']:.3f}")
    print(f"     • Stability: {learning_analysis['stability']:.3f}")
    
    print("\n  🎯 Current Capabilities:")
    capabilities = system_summary['capabilities']
    for capability, score in capabilities.items():
        bar = "█" * int(score * 20) + "░" * (20 - int(score * 20))
        print(f"     • {capability.replace('_', ' ').title()}: [{bar}] {score:.1%}")
    
    # Demo 5: Neural Architecture Adaptation
    print("\n🔧 Demo 5: Neural Architecture Adaptation")
    print("-" * 38)
    
    neural_summary = system_summary['neural_summary']
    print(f"  🏗️  Architecture adaptations: {len(neural_summary.get('recent_adaptations', []))}")
    
    if neural_summary.get('recent_adaptations'):
        print("     Recent adaptations:")
        for adaptation in neural_summary['recent_adaptations'][-3:]:
            step = adaptation.get('step', 'unknown')
            modification = adaptation.get('modification_attempted', 'unknown')
            print(f"     • Step {step}: {modification}")
    else:
        print("     No recent adaptations (system is stable)")
    
    # Demo 6: Agent Coordination
    print("\n🤖 Demo 6: Agent Coordination")
    print("-" * 28)
    
    agent_state = system_summary['agent_state']
    print(f"  📡 Processing cycles: {agent_state['processing_cycles']:,}")
    print(f"  💬 Messages processed: {agent_state['total_messages_processed']:,}")
    
    print("\n  🎭 Agent Performance:")
    agent_states = agent_state['agent_states']
    for agent_type, state in agent_states.items():
        performance_avg = np.mean(state['performance_history'][-5:]) if state['performance_history'] else 0.0
        print(f"     • {agent_type.replace('_', ' ').title()}: {performance_avg:.3f}")
    
    print("\n🎉 Demo completed successfully!")
    print(f"💾 System state can be saved for future use")
    
    return system


def demo_interactive_learning():
    """Demonstrate interactive learning with user input"""
    
    print("\n🎮 Interactive Learning Demo")
    print("=" * 30)
    
    system = create_self_learning_system()
    
    print("Enter knowledge items for the AI to learn (type 'quit' to exit):")
    print("Format: <knowledge text>")
    
    while True:
        try:
            user_input = input("\n📝 Enter knowledge: ").strip()
            
            if user_input.lower() in ['quit', 'exit', 'q']:
                break
            
            if not user_input:
                continue
            
            # Process user input
            input_data = torch.randn(1, 512)  # Placeholder embedding
            context = {
                'content': user_input,
                'node_type': 'user_input',
                'semantic_tags': ['interactive', 'user']
            }
            
            print("🧠 Processing...")
            results = system(input_data, context=context)
            
            # Show results
            if 'knowledge_graph' in results:
                kg_results = results['knowledge_graph']
                if 'new_node_id' in kg_results:
                    print(f"✅ Added to knowledge base as {kg_results['new_node_id']}")
                
                if 'related_knowledge' in kg_results and kg_results['related_knowledge']:
                    print("🔗 Related knowledge found:")
                    for item in kg_results['related_knowledge'][:2]:
                        content = item.get('content', 'Unknown')
                        similarity = item.get('similarity', 0.0)
                        print(f"   • {content} (similarity: {similarity:.3f})")
            
            # Show system stats
            stats = system.knowledge_graph.get_graph_statistics()
            print(f"📊 Knowledge base: {stats['num_nodes']} nodes, {stats['num_edges']} connections")
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"❌ Error: {e}")
    
    print("\n👋 Interactive demo ended")
    return system


def demo_dashboard():
    """Launch the interactive dashboard"""
    
    print("\n🖥️  Launching Interactive Dashboard")
    print("=" * 35)
    
    # Create system with some initial knowledge
    system = create_self_learning_system()
    
    # Add some sample data
    sample_data = [
        {"content": "Artificial intelligence is transforming technology", "type": "ai"},
        {"content": "Machine learning algorithms learn from data", "type": "ml"},
        {"content": "Neural networks mimic brain structure", "type": "neural"},
        {"content": "Deep learning uses multiple layers", "type": "deep"},
        {"content": "Natural language processing understands text", "type": "nlp"}
    ]
    
    print("📚 Adding sample knowledge...")
    for item in sample_data:
        input_data = torch.randn(1, 512)
        context = {
            'content': item['content'],
            'node_type': item['type'],
            'semantic_tags': [item['type'], 'sample']
        }
        system(input_data, context=context)
    
    # Create and launch dashboard
    print("🚀 Starting dashboard server...")
    dashboard = create_dashboard(system)
    
    print("🌐 Dashboard will be available at: http://localhost:8050")
    print("📊 Monitor real-time learning progress and interact with the system")
    print("⚠️  Press Ctrl+C to stop the dashboard")
    
    try:
        dashboard.run(host='0.0.0.0', port=8050, debug=False)
    except KeyboardInterrupt:
        print("\n🛑 Dashboard stopped")
        dashboard.shutdown()


def run_performance_benchmark():
    """Run performance benchmarks"""
    
    print("\n⚡ Performance Benchmark")
    print("=" * 25)
    
    system = create_self_learning_system()
    
    # Benchmark different operations
    benchmarks = {
        'knowledge_addition': [],
        'knowledge_retrieval': [],
        'neural_processing': [],
        'agent_coordination': []
    }
    
    print("🏃 Running benchmarks...")
    
    # Knowledge addition benchmark
    for i in range(10):
        start_time = time.time()
        
        input_data = torch.randn(1, 512)
        context = {'content': f'benchmark knowledge {i}', 'node_type': 'benchmark'}
        system(input_data, context=context)
        
        elapsed = time.time() - start_time
        benchmarks['knowledge_addition'].append(elapsed)
    
    # Knowledge retrieval benchmark
    for i in range(10):
        start_time = time.time()
        
        query_data = torch.randn(1, 512)
        system.knowledge_graph.query_knowledge(query_data.squeeze(0), top_k=5)
        
        elapsed = time.time() - start_time
        benchmarks['knowledge_retrieval'].append(elapsed)
    
    # Neural processing benchmark
    for i in range(10):
        start_time = time.time()
        
        input_data = torch.randn(5, 512)
        target_data = torch.randn(5, 512)
        system.neural_core(input_data, target_data)
        
        elapsed = time.time() - start_time
        benchmarks['neural_processing'].append(elapsed)
    
    # Agent coordination benchmark
    for i in range(10):
        start_time = time.time()
        
        input_data = torch.randn(3, 512)
        system.agent_coordinator.process_cycle(input_data)
        
        elapsed = time.time() - start_time
        benchmarks['agent_coordination'].append(elapsed)
    
    # Print results
    print("\n📊 Benchmark Results:")
    print("-" * 20)
    
    for operation, times in benchmarks.items():
        avg_time = np.mean(times)
        std_time = np.std(times)
        min_time = np.min(times)
        max_time = np.max(times)
        
        print(f"{operation.replace('_', ' ').title()}:")
        print(f"  Average: {avg_time:.4f}s ± {std_time:.4f}s")
        print(f"  Range: {min_time:.4f}s - {max_time:.4f}s")
        print()


def main():
    """Main demo function"""
    
    parser = argparse.ArgumentParser(description='Self-Learning AI System Demo')
    parser.add_argument('--mode', choices=['basic', 'interactive', 'dashboard', 'benchmark'], 
                       default='basic', help='Demo mode to run')
    parser.add_argument('--save-state', type=str, help='Save system state to file')
    parser.add_argument('--load-state', type=str, help='Load system state from file')
    
    args = parser.parse_args()
    
    print("🧠 Self-Learning AI System")
    print("🚀 Advanced AI with Hierarchical Memory, Agent Coordination, and Adaptive Architecture")
    print("=" * 80)
    
    system = None
    
    try:
        if args.mode == 'basic':
            system = demo_basic_learning()
        elif args.mode == 'interactive':
            system = demo_interactive_learning()
        elif args.mode == 'dashboard':
            demo_dashboard()
        elif args.mode == 'benchmark':
            run_performance_benchmark()
        
        # Save state if requested
        if args.save_state and system:
            print(f"\n💾 Saving system state to {args.save_state}")
            system.save_system_state(args.save_state)
            print("✅ State saved successfully")
        
    except KeyboardInterrupt:
        print("\n\n👋 Demo interrupted by user")
    except Exception as e:
        print(f"\n❌ Demo error: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n🎉 Thank you for exploring the Self-Learning AI System!")
    print("🔬 This system demonstrates cutting-edge AI research concepts:")
    print("   • Hierarchical Memory (Short-term, Working, Long-term)")
    print("   • Multi-Agent Learning Coordination")
    print("   • Self-Modifying Neural Architecture")
    print("   • Dynamic Knowledge Graphs")
    print("   • Continuous Self-Improvement")


if __name__ == "__main__":
    main()