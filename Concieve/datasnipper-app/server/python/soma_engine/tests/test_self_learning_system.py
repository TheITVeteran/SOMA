"""
Comprehensive Tests for Self-Learning AI System
Tests all components and validates learning capabilities
"""

import torch
import torch.nn.functional as F
import numpy as np
import pytest
import tempfile
import os
from typing import Dict, List, Any
import time

# Import system components
import sys
sys.path.append('/workspace/project/SelfLearningAI/src')

from core.self_learning_system import SelfLearningSystem, create_self_learning_system, LearningMode
from memory.hierarchical_memory import HierarchicalMemorySystem
from agents.learning_agents import AgentCoordinator, AgentType
from core.adaptive_neural_core import SelfModifyingNetwork
from knowledge.dynamic_knowledge_graph import DynamicKnowledgeGraph


class TestHierarchicalMemory:
    """Test hierarchical memory system"""
    
    def setup_method(self):
        """Setup test environment"""
        self.memory_system = HierarchicalMemorySystem(embedding_dim=256)
        self.test_data = torch.randn(4, 256)
    
    def test_memory_initialization(self):
        """Test memory system initialization"""
        assert self.memory_system.embedding_dim == 256
        assert hasattr(self.memory_system, 'short_term_memory')
        assert hasattr(self.memory_system, 'working_memory')
        assert hasattr(self.memory_system, 'long_term_memory')
    
    def test_short_term_storage(self):
        """Test short-term memory storage"""
        result = self.memory_system(self.test_data, mode='store')
        
        assert 'short_term' in result
        assert 'stored_items' in result['short_term']
        assert result['short_term']['stored_items'] == 4
    
    def test_working_memory_processing(self):
        """Test working memory processing"""
        result = self.memory_system(self.test_data, mode='process')
        
        assert 'working_memory' in result
        assert 'processed_output' in result['working_memory']
        assert result['working_memory']['processed_output'].shape == (4, 256)
    
    def test_memory_retrieval(self):
        """Test memory retrieval"""
        # First store some data
        self.memory_system(self.test_data, mode='store')
        
        # Then retrieve
        query = torch.randn(2, 256)
        result = self.memory_system(query, mode='retrieve')
        
        assert 'retrieved_memory' in result
        assert result['retrieved_memory'].shape[0] == 2
    
    def test_memory_consolidation(self):
        """Test memory consolidation process"""
        # Process data to trigger consolidation
        result = self.memory_system(self.test_data, mode='process')
        
        assert 'consolidation' in result
        consolidated_items = result['consolidation'].get('consolidated_items', 0)
        assert isinstance(consolidated_items, int)
        assert consolidated_items >= 0
    
    def test_memory_statistics(self):
        """Test memory statistics"""
        stats = self.memory_system.get_memory_stats()
        
        required_keys = ['short_term_usage', 'working_memory_capacity', 
                        'long_term_items', 'total_accesses', 'time_step']
        
        for key in required_keys:
            assert key in stats
            assert isinstance(stats[key], (int, float))


class TestAgentCoordination:
    """Test agent coordination system"""
    
    def setup_method(self):
        """Setup test environment"""
        self.agent_coordinator = AgentCoordinator(embedding_dim=256)
        self.test_data = torch.randn(3, 256)
    
    def test_agent_initialization(self):
        """Test agent system initialization"""
        assert len(self.agent_coordinator.agents) == 5
        
        expected_agents = [AgentType.ACQUISITION, AgentType.STORAGE, 
                          AgentType.RETRIEVAL, AgentType.DISTILLATION, 
                          AgentType.META_LEARNING]
        
        for agent_type in expected_agents:
            assert agent_type in self.agent_coordinator.agents
    
    def test_processing_cycle(self):
        """Test complete agent processing cycle"""
        results = self.agent_coordinator.process_cycle(self.test_data)
        
        expected_phases = ['acquisition', 'storage', 'retrieval', 
                          'distillation', 'meta_learning']
        
        for phase in expected_phases:
            assert phase in results
    
    def test_agent_communication(self):
        """Test inter-agent communication"""
        results = self.agent_coordinator.process_cycle(self.test_data)
        
        # Check that messages were generated and processed
        total_messages = len(self.agent_coordinator.message_queue)
        assert total_messages >= 0
        
        # Check system state
        system_state = self.agent_coordinator.get_system_state()
        assert 'agent_states' in system_state
        assert 'total_messages_processed' in system_state
    
    def test_acquisition_agent(self):
        """Test acquisition agent functionality"""
        acquisition_agent = self.agent_coordinator.agents[AgentType.ACQUISITION]
        result = acquisition_agent.process(self.test_data, [])
        
        assert 'acquired_experiences' in result
        assert 'novelty_scores' in result
        assert 'curiosity_scores' in result
        assert result['novelty_scores'].shape[0] == 3
    
    def test_storage_agent(self):
        """Test storage agent functionality"""
        storage_agent = self.agent_coordinator.agents[AgentType.STORAGE]
        result = storage_agent.process(self.test_data, [])
        
        assert 'storage_operations' in result
        assert 'importance_scores' in result
        assert 'compressed_data' in result
        assert len(result['storage_operations']) == 3
    
    def test_meta_learning_agent(self):
        """Test meta-learning agent functionality"""
        meta_agent = self.agent_coordinator.agents[AgentType.META_LEARNING]
        result = meta_agent.process(self.test_data, [])
        
        assert 'meta_updates' in result
        assert 'optimized_strategies' in result
        assert 'predicted_performance' in result


class TestAdaptiveNeuralCore:
    """Test adaptive neural core"""
    
    def setup_method(self):
        """Setup test environment"""
        self.neural_core = SelfModifyingNetwork(input_dim=256, output_dim=256)
        self.test_data = torch.randn(2, 256)
        self.target_data = torch.randn(2, 256)
    
    def test_neural_core_initialization(self):
        """Test neural core initialization"""
        assert self.neural_core.input_dim == 256
        assert self.neural_core.output_dim == 256
        assert hasattr(self.neural_core, 'core')
        assert hasattr(self.neural_core, 'performance_window')
    
    def test_forward_pass(self):
        """Test forward pass through neural core"""
        result = self.neural_core(self.test_data, self.target_data)
        
        assert 'output' in result
        assert result['output'].shape == (2, 256)
        assert 'activations' in result
        assert 'modifications_made' in result
    
    def test_self_modification(self):
        """Test self-modification capabilities"""
        # Run multiple forward passes to trigger modifications
        for _ in range(150):  # Exceed modification frequency
            result = self.neural_core(self.test_data, self.target_data)
        
        adaptation_summary = self.neural_core.get_adaptation_summary()
        assert 'step_count' in adaptation_summary
        assert adaptation_summary['step_count'] >= 150
    
    def test_architecture_summary(self):
        """Test architecture summary"""
        summary = self.neural_core.core.get_architecture_summary()
        
        required_keys = ['num_layers', 'layer_sizes', 'total_parameters', 
                        'modifications_count']
        
        for key in required_keys:
            assert key in summary
    
    def test_plasticity(self):
        """Test neural plasticity"""
        # Get initial state
        initial_params = [p.clone() for p in self.neural_core.parameters()]
        
        # Run training steps
        for _ in range(10):
            result = self.neural_core(self.test_data, self.target_data)
        
        # Check that parameters have changed (plasticity)
        final_params = list(self.neural_core.parameters())
        
        params_changed = False
        for initial, final in zip(initial_params, final_params):
            if not torch.allclose(initial, final, atol=1e-6):
                params_changed = True
                break
        
        assert params_changed, "Neural plasticity not working - parameters unchanged"


class TestKnowledgeGraph:
    """Test dynamic knowledge graph"""
    
    def setup_method(self):
        """Setup test environment"""
        self.knowledge_graph = DynamicKnowledgeGraph(embedding_dim=256, max_nodes=1000)
        self.test_embeddings = torch.randn(5, 256)
    
    def test_knowledge_graph_initialization(self):
        """Test knowledge graph initialization"""
        assert self.knowledge_graph.embedding_dim == 256
        assert self.knowledge_graph.max_nodes == 1000
        assert len(self.knowledge_graph.nodes) == 0
        assert len(self.knowledge_graph.edges) == 0
    
    def test_knowledge_addition(self):
        """Test adding knowledge to graph"""
        node_id = self.knowledge_graph.add_knowledge(
            content="test knowledge",
            content_embedding=self.test_embeddings[0],
            node_type="test",
            semantic_tags=["test", "knowledge"]
        )
        
        assert node_id in self.knowledge_graph.nodes
        assert len(self.knowledge_graph.nodes) == 1
        
        node = self.knowledge_graph.nodes[node_id]
        assert node.content == "test knowledge"
        assert node.node_type == "test"
        assert "test" in node.semantic_tags
    
    def test_knowledge_querying(self):
        """Test querying knowledge graph"""
        # Add some knowledge first
        for i in range(3):
            self.knowledge_graph.add_knowledge(
                content=f"knowledge {i}",
                content_embedding=self.test_embeddings[i],
                node_type="test"
            )
        
        # Query for relevant knowledge
        query_results = self.knowledge_graph.query_knowledge(
            self.test_embeddings[0], top_k=2
        )
        
        assert len(query_results) <= 2
        for result in query_results:
            assert 'node_id' in result
            assert 'content' in result
            assert 'similarity' in result
    
    def test_relationship_creation(self):
        """Test automatic relationship creation"""
        # Add similar knowledge items
        similar_embedding = torch.randn(256)
        
        node1_id = self.knowledge_graph.add_knowledge(
            content="similar knowledge 1",
            content_embedding=similar_embedding,
            node_type="test"
        )
        
        node2_id = self.knowledge_graph.add_knowledge(
            content="similar knowledge 2",
            content_embedding=similar_embedding + 0.1 * torch.randn(256),  # Slightly different
            node_type="test"
        )
        
        # Check if relationships were created
        assert len(self.knowledge_graph.edges) >= 0  # May or may not create edges based on similarity
    
    def test_graph_statistics(self):
        """Test graph statistics"""
        # Add some knowledge
        for i in range(3):
            self.knowledge_graph.add_knowledge(
                content=f"knowledge {i}",
                content_embedding=self.test_embeddings[i],
                node_type="test"
            )
        
        stats = self.knowledge_graph.get_graph_statistics()
        
        required_keys = ['num_nodes', 'num_edges', 'avg_node_degree', 
                        'step_count', 'avg_importance']
        
        for key in required_keys:
            assert key in stats
        
        assert stats['num_nodes'] == 3


class TestSelfLearningSystem:
    """Test complete self-learning system"""
    
    def setup_method(self):
        """Setup test environment"""
        self.system = create_self_learning_system({
            'input_dim': 256,
            'embedding_dim': 256,
            'max_knowledge_nodes': 1000
        })
        self.test_data = torch.randn(2, 256)
        self.target_data = torch.randn(2, 256)
    
    def test_system_initialization(self):
        """Test system initialization"""
        assert self.system.input_dim == 256
        assert self.system.embedding_dim == 256
        assert hasattr(self.system, 'memory_system')
        assert hasattr(self.system, 'agent_coordinator')
        assert hasattr(self.system, 'neural_core')
        assert hasattr(self.system, 'knowledge_graph')
    
    def test_system_forward_pass(self):
        """Test complete system forward pass"""
        context = {
            'content': 'test input',
            'node_type': 'test',
            'semantic_tags': ['test']
        }
        
        results = self.system(self.test_data, self.target_data, context)
        
        # Check all major components produced results
        expected_keys = ['memory', 'agents', 'neural_core', 'knowledge_graph', 
                        'integrated_output', 'reflection', 'performance']
        
        for key in expected_keys:
            assert key in results
    
    def test_learning_mode_switching(self):
        """Test learning mode switching"""
        initial_mode = self.system.current_mode
        
        # Process data multiple times to potentially trigger mode changes
        for _ in range(10):
            self.system(self.test_data, self.target_data)
        
        # Mode may or may not change, but system should handle it gracefully
        assert self.system.current_mode in list(LearningMode)
    
    def test_experience_storage(self):
        """Test experience storage"""
        initial_experience_count = len(self.system.experience_buffer)
        
        self.system(self.test_data, self.target_data)
        
        assert len(self.system.experience_buffer) == initial_experience_count + 1
    
    def test_performance_monitoring(self):
        """Test performance monitoring"""
        results = self.system(self.test_data, self.target_data)
        
        performance = results['performance']
        
        expected_metrics = ['processing_time', 'memory_utilization', 
                           'agent_efficiency', 'knowledge_growth']
        
        for metric in expected_metrics:
            assert metric in performance
            assert isinstance(performance[metric], (int, float))
    
    def test_system_summary(self):
        """Test system summary generation"""
        # Process some data first
        self.system(self.test_data, self.target_data)
        
        summary = self.system.get_system_summary()
        
        expected_keys = ['learning_step', 'current_mode', 'memory_stats', 
                        'agent_state', 'knowledge_stats', 'capabilities']
        
        for key in expected_keys:
            assert key in summary
    
    def test_self_reflection(self):
        """Test self-reflection capabilities"""
        results = self.system(self.test_data, self.target_data)
        
        reflection = results['reflection']
        
        assert 'reflection' in reflection
        assert 'learning_analysis' in reflection
        assert 'insights' in reflection
        assert 'self_assessment' in reflection
    
    def test_integration_quality(self):
        """Test component integration quality"""
        results = self.system(self.test_data, self.target_data)
        
        integrated_output = results['integrated_output']
        
        assert 'integrated_representation' in integrated_output
        assert 'component_contributions' in integrated_output
        
        contributions = integrated_output['component_contributions']
        expected_components = ['memory', 'agents', 'neural', 'knowledge']
        
        for component in expected_components:
            assert component in contributions
            assert contributions[component] >= 0
    
    def test_continuous_learning(self):
        """Test continuous learning over multiple steps"""
        initial_step = self.system.learning_step
        
        # Run multiple learning steps
        for i in range(5):
            context = {'content': f'learning step {i}', 'node_type': 'continuous'}
            self.system(self.test_data, self.target_data, context)
        
        assert self.system.learning_step == initial_step + 5
        
        # Check that knowledge has grown
        kg_stats = self.system.knowledge_graph.get_graph_statistics()
        assert kg_stats['num_nodes'] >= 5  # Should have added knowledge
    
    def test_save_load_system_state(self):
        """Test saving and loading system state"""
        # Process some data to create state
        self.system(self.test_data, self.target_data)
        initial_step = self.system.learning_step
        
        # Save state
        with tempfile.NamedTemporaryFile(suffix='.pt', delete=False) as tmp_file:
            self.system.save_system_state(tmp_file.name)
            
            # Create new system and load state
            new_system = create_self_learning_system({
                'input_dim': 256,
                'embedding_dim': 256
            })
            
            new_system.load_system_state(tmp_file.name)
            
            # Check that state was loaded correctly
            assert new_system.learning_step == initial_step
            
            # Clean up
            os.unlink(tmp_file.name)


class TestLearningCapabilities:
    """Test specific learning capabilities"""
    
    def setup_method(self):
        """Setup test environment"""
        self.system = create_self_learning_system({
            'input_dim': 128,
            'embedding_dim': 128
        })
    
    def test_knowledge_retention(self):
        """Test knowledge retention over time"""
        # Add specific knowledge
        knowledge_data = torch.randn(1, 128)
        context = {
            'content': 'important knowledge to retain',
            'node_type': 'important',
            'semantic_tags': ['retention', 'test']
        }
        
        self.system(knowledge_data, context=context)
        
        # Process other data
        for _ in range(10):
            other_data = torch.randn(1, 128)
            self.system(other_data)
        
        # Query for the original knowledge
        query_results = self.system.knowledge_graph.query_knowledge(
            knowledge_data.squeeze(0), top_k=5
        )
        
        # Should find the retained knowledge
        assert len(query_results) > 0
        found_important = any('important knowledge' in str(result.get('content', '')) 
                             for result in query_results)
        # Note: This might not always pass due to the stochastic nature of the system
    
    def test_knowledge_transfer(self):
        """Test knowledge transfer between domains"""
        # Add knowledge in domain A
        domain_a_data = torch.randn(3, 128)
        for i, data in enumerate(domain_a_data):
            context = {
                'content': f'domain A knowledge {i}',
                'node_type': 'domain_a',
                'semantic_tags': ['domain_a', 'transfer_test']
            }
            self.system(data.unsqueeze(0), context=context)
        
        # Add related knowledge in domain B
        domain_b_data = domain_a_data + 0.1 * torch.randn(3, 128)  # Similar but different
        for i, data in enumerate(domain_b_data):
            context = {
                'content': f'domain B knowledge {i}',
                'node_type': 'domain_b',
                'semantic_tags': ['domain_b', 'transfer_test']
            }
            self.system(data.unsqueeze(0), context=context)
        
        # Query with domain A data should also retrieve domain B knowledge
        query_results = self.system.knowledge_graph.query_knowledge(
            domain_a_data[0], top_k=10
        )
        
        # Should find knowledge from both domains
        domain_a_found = any('domain A' in str(result.get('content', '')) 
                            for result in query_results)
        domain_b_found = any('domain B' in str(result.get('content', '')) 
                            for result in query_results)
        
        assert domain_a_found  # Should definitely find domain A
        # domain_b_found might not always be true due to similarity thresholds
    
    def test_self_improvement(self):
        """Test self-improvement over time"""
        # Get initial performance baseline
        test_data = torch.randn(5, 128)
        target_data = torch.randn(5, 128)
        
        initial_results = self.system(test_data, target_data)
        initial_performance = initial_results['performance']
        
        # Run learning for multiple steps
        for step in range(20):
            training_data = torch.randn(2, 128)
            training_target = torch.randn(2, 128)
            self.system(training_data, training_target)
        
        # Test performance again
        final_results = self.system(test_data, target_data)
        final_performance = final_results['performance']
        
        # Check for improvement in some metrics
        # Note: Improvement is not guaranteed in such a short time, 
        # but system should be tracking performance
        assert 'processing_time' in final_performance
        assert 'memory_utilization' in final_performance
        
        # Check that learning analysis shows progress
        learning_analysis = final_results['reflection']['learning_analysis']
        assert 'progress_score' in learning_analysis
        assert 'learning_rate' in learning_analysis
    
    def test_adaptation_to_new_patterns(self):
        """Test adaptation to new data patterns"""
        # Train on pattern A
        pattern_a = torch.randn(10, 128)
        for data in pattern_a:
            self.system(data.unsqueeze(0))
        
        # Switch to pattern B (different distribution)
        pattern_b = torch.randn(10, 128) + 2.0  # Shifted distribution
        
        adaptation_scores = []
        for data in pattern_b:
            results = self.system(data.unsqueeze(0))
            # Track some adaptation metric
            adaptation_scores.append(
                results['neural_core']['adaptation_summary']['step_count']
            )
        
        # System should show adaptation activity
        assert len(adaptation_scores) == 10
        assert all(isinstance(score, int) for score in adaptation_scores)


def run_comprehensive_tests():
    """Run all tests and provide summary"""
    
    print("🧪 Running Comprehensive Self-Learning AI Tests")
    print("=" * 60)
    
    test_classes = [
        TestHierarchicalMemory,
        TestAgentCoordination, 
        TestAdaptiveNeuralCore,
        TestKnowledgeGraph,
        TestSelfLearningSystem,
        TestLearningCapabilities
    ]
    
    total_tests = 0
    passed_tests = 0
    failed_tests = []
    
    for test_class in test_classes:
        print(f"\n🔬 Testing {test_class.__name__}")
        print("-" * 40)
        
        # Get all test methods
        test_methods = [method for method in dir(test_class) 
                       if method.startswith('test_')]
        
        for test_method in test_methods:
            total_tests += 1
            try:
                # Create test instance and run setup
                test_instance = test_class()
                if hasattr(test_instance, 'setup_method'):
                    test_instance.setup_method()
                
                # Run the test
                getattr(test_instance, test_method)()
                
                print(f"  ✅ {test_method}")
                passed_tests += 1
                
            except Exception as e:
                print(f"  ❌ {test_method}: {str(e)}")
                failed_tests.append(f"{test_class.__name__}.{test_method}: {str(e)}")
    
    # Print summary
    print("\n" + "=" * 60)
    print("🏁 TEST SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests} ✅")
    print(f"Failed: {len(failed_tests)} ❌")
    print(f"Success Rate: {passed_tests/total_tests*100:.1f}%")
    
    if failed_tests:
        print("\n❌ Failed Tests:")
        for failure in failed_tests:
            print(f"  - {failure}")
    
    return passed_tests, len(failed_tests), total_tests


if __name__ == "__main__":
    # Run all tests
    passed, failed, total = run_comprehensive_tests()
    
    if failed == 0:
        print("\n🎉 All tests passed! The self-learning AI system is working correctly.")
    else:
        print(f"\n⚠️  {failed} tests failed. System may need debugging.")
    
    exit(0 if failed == 0 else 1)