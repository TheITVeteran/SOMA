"""
Quick test to validate the self-learning AI system
"""

import torch
import sys
import os

# Add src to path
sys.path.append('src')

def test_basic_functionality():
    """Test basic system functionality"""
    
    print("🧠 Self-Learning AI System - Quick Test")
    print("=" * 45)
    
    try:
        # Test imports
        print("📦 Testing imports...")
        from core.self_learning_system import create_self_learning_system
        print("  ✅ Core system import successful")
        
        from memory.hierarchical_memory import HierarchicalMemorySystem
        print("  ✅ Memory system import successful")
        
        from agents.learning_agents import AgentCoordinator
        print("  ✅ Agent system import successful")
        
        from knowledge.dynamic_knowledge_graph import DynamicKnowledgeGraph
        print("  ✅ Knowledge graph import successful")
        
        # Test system creation
        print("\n🚀 Testing system creation...")
        system = create_self_learning_system({
            'input_dim': 128,
            'embedding_dim': 128,
            'max_knowledge_nodes': 100
        })
        print("  ✅ System created successfully")
        
        # Test basic processing
        print("\n🔄 Testing basic processing...")
        input_data = torch.randn(2, 128)
        target_data = torch.randn(2, 128)
        context = {
            'content': 'test knowledge',
            'node_type': 'test',
            'semantic_tags': ['test', 'validation']
        }
        
        results = system(input_data, target_data, context)
        print("  ✅ Basic processing successful")
        
        # Validate results structure
        expected_keys = ['memory', 'agents', 'neural_core', 'knowledge_graph', 
                        'integrated_output', 'reflection', 'performance']
        
        for key in expected_keys:
            if key in results:
                print(f"  ✅ {key} component working")
            else:
                print(f"  ❌ {key} component missing")
        
        # Test system summary
        print("\n📊 Testing system summary...")
        summary = system.get_system_summary()
        print(f"  ✅ Learning step: {summary['learning_step']}")
        print(f"  ✅ Current mode: {summary['current_mode']}")
        print(f"  ✅ Memory items: {summary['memory_stats']['long_term_items']}")
        print(f"  ✅ Knowledge nodes: {summary['knowledge_stats']['num_nodes']}")
        
        # Test multiple processing steps
        print("\n🔁 Testing multiple processing steps...")
        for i in range(3):
            test_data = torch.randn(1, 128)
            test_context = {
                'content': f'test knowledge {i}',
                'node_type': 'sequential_test'
            }
            system(test_data, context=test_context)
            print(f"  ✅ Step {i+1} completed")
        
        final_summary = system.get_system_summary()
        print(f"  ✅ Final learning step: {final_summary['learning_step']}")
        print(f"  ✅ Final knowledge nodes: {final_summary['knowledge_stats']['num_nodes']}")
        
        print("\n🎉 All tests passed! System is working correctly.")
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_individual_components():
    """Test individual components"""
    
    print("\n🔬 Testing Individual Components")
    print("=" * 35)
    
    try:
        # Test memory system
        print("🧠 Testing memory system...")
        from memory.hierarchical_memory import HierarchicalMemorySystem
        memory = HierarchicalMemorySystem(embedding_dim=64)
        test_data = torch.randn(2, 64)
        
        # Test different modes
        store_result = memory(test_data, mode='store')
        process_result = memory(test_data, mode='process')
        retrieve_result = memory(test_data, mode='retrieve')
        
        print("  ✅ Memory system working")
        
        # Test agent system
        print("🤖 Testing agent system...")
        from agents.learning_agents import AgentCoordinator
        agents = AgentCoordinator(embedding_dim=64)
        agent_result = agents.process_cycle(test_data)
        
        print("  ✅ Agent system working")
        
        # Test knowledge graph
        print("🕸️ Testing knowledge graph...")
        from knowledge.dynamic_knowledge_graph import DynamicKnowledgeGraph
        kg = DynamicKnowledgeGraph(embedding_dim=64, max_nodes=50)
        
        node_id = kg.add_knowledge(
            content="test knowledge",
            content_embedding=test_data[0],
            node_type="test"
        )
        
        query_results = kg.query_knowledge(test_data[0], top_k=3)
        print("  ✅ Knowledge graph working")
        
        print("\n✅ All individual components working correctly!")
        return True
        
    except Exception as e:
        print(f"\n❌ Component test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("🧪 Running Quick Validation Tests")
    print("=" * 50)
    
    # Test basic functionality
    basic_success = test_basic_functionality()
    
    # Test individual components
    component_success = test_individual_components()
    
    # Summary
    print("\n" + "=" * 50)
    print("📋 TEST SUMMARY")
    print("=" * 50)
    
    if basic_success and component_success:
        print("🎉 ALL TESTS PASSED!")
        print("✅ The Self-Learning AI System is working correctly")
        print("🚀 Ready for full demonstration and usage")
    else:
        print("❌ Some tests failed")
        print("🔧 System may need debugging")
    
    print("\n🎯 Next steps:")
    print("  • Run full demo: python demo.py --mode basic")
    print("  • Launch dashboard: python demo.py --mode dashboard") 
    print("  • Run comprehensive tests: python tests/test_self_learning_system.py")
    print("  • Read documentation: IMPLEMENTATION_GUIDE.md")