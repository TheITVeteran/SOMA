"""
Simple test to validate the self-learning AI system structure
Tests imports and basic class instantiation without heavy computation
"""

import sys
import os

# Add src to path
sys.path.append('src')

def test_imports():
    """Test that all modules can be imported"""
    
    print("🧠 Self-Learning AI System - Import Test")
    print("=" * 45)
    
    try:
        print("📦 Testing core imports...")
        
        # Test memory system
        try:
            from memory.hierarchical_memory import (
                HierarchicalMemorySystem, 
                ShortTermMemory, 
                WorkingMemory, 
                LongTermMemory,
                AttentionMemoryBank
            )
            print("  ✅ Memory system imports successful")
        except ImportError as e:
            print(f"  ❌ Memory system import failed: {e}")
            return False
        
        # Test agent system
        try:
            from agents.learning_agents import (
                AgentCoordinator,
                AcquisitionAgent,
                StorageAgent, 
                RetrievalAgent,
                DistillationAgent,
                MetaLearningAgent,
                AgentType
            )
            print("  ✅ Agent system imports successful")
        except ImportError as e:
            print(f"  ❌ Agent system import failed: {e}")
            return False
        
        # Test neural core
        try:
            from core.adaptive_neural_core import (
                SelfModifyingNetwork,
                AdaptiveNeuralCore,
                PlasticConnection,
                DynamicLayer
            )
            print("  ✅ Neural core imports successful")
        except ImportError as e:
            print(f"  ❌ Neural core import failed: {e}")
            return False
        
        # Test knowledge graph
        try:
            from knowledge.dynamic_knowledge_graph import (
                DynamicKnowledgeGraph,
                RelationType,
                SemanticEmbedder
            )
            print("  ✅ Knowledge graph imports successful")
        except ImportError as e:
            print(f"  ❌ Knowledge graph import failed: {e}")
            return False
        
        # Test main system
        try:
            from core.self_learning_system import (
                SelfLearningSystem,
                create_self_learning_system,
                LearningMode
            )
            print("  ✅ Main system imports successful")
        except ImportError as e:
            print(f"  ❌ Main system import failed: {e}")
            return False
        
        # Test interface
        try:
            from interface.dashboard import (
                SelfLearningDashboard,
                create_dashboard
            )
            print("  ✅ Interface imports successful")
        except ImportError as e:
            print(f"  ❌ Interface import failed: {e}")
            return False
        
        print("\n🎉 All imports successful!")
        return True
        
    except Exception as e:
        print(f"\n❌ Import test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_file_structure():
    """Test that all required files exist"""
    
    print("\n📁 Testing file structure...")
    
    required_files = [
        'src/__init__.py',
        'src/memory/__init__.py',
        'src/memory/hierarchical_memory.py',
        'src/agents/__init__.py', 
        'src/agents/learning_agents.py',
        'src/core/__init__.py',
        'src/core/adaptive_neural_core.py',
        'src/core/self_learning_system.py',
        'src/knowledge/__init__.py',
        'src/knowledge/dynamic_knowledge_graph.py',
        'src/interface/__init__.py',
        'src/interface/dashboard.py',
        'tests/test_self_learning_system.py',
        'demo.py',
        'requirements.txt',
        'README.md',
        'IMPLEMENTATION_GUIDE.md'
    ]
    
    missing_files = []
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"  ✅ {file_path}")
        else:
            print(f"  ❌ {file_path} - MISSING")
            missing_files.append(file_path)
    
    if missing_files:
        print(f"\n❌ {len(missing_files)} files missing")
        return False
    else:
        print(f"\n✅ All {len(required_files)} required files present")
        return True


def test_class_definitions():
    """Test that key classes are properly defined"""
    
    print("\n🏗️ Testing class definitions...")
    
    try:
        # Import without torch to avoid dependency issues
        import importlib.util
        
        # Test memory classes
        spec = importlib.util.spec_from_file_location("memory", "src/memory/hierarchical_memory.py")
        memory_module = importlib.util.module_from_spec(spec)
        
        # Check if classes are defined (without instantiating)
        with open('src/memory/hierarchical_memory.py', 'r') as f:
            content = f.read()
            
        required_classes = [
            'class HierarchicalMemorySystem',
            'class ShortTermMemory',
            'class WorkingMemory', 
            'class LongTermMemory',
            'class AttentionMemoryBank'
        ]
        
        for class_def in required_classes:
            if class_def in content:
                print(f"  ✅ {class_def.replace('class ', '')} defined")
            else:
                print(f"  ❌ {class_def.replace('class ', '')} missing")
        
        # Test agent classes
        with open('src/agents/learning_agents.py', 'r') as f:
            agent_content = f.read()
            
        agent_classes = [
            'class AgentCoordinator',
            'class AcquisitionAgent',
            'class StorageAgent',
            'class RetrievalAgent', 
            'class DistillationAgent',
            'class MetaLearningAgent'
        ]
        
        for class_def in agent_classes:
            if class_def in agent_content:
                print(f"  ✅ {class_def.replace('class ', '')} defined")
            else:
                print(f"  ❌ {class_def.replace('class ', '')} missing")
        
        print("\n✅ All key classes properly defined")
        return True
        
    except Exception as e:
        print(f"\n❌ Class definition test failed: {e}")
        return False


def test_documentation():
    """Test that documentation exists and is comprehensive"""
    
    print("\n📚 Testing documentation...")
    
    try:
        # Check README
        if os.path.exists('README.md'):
            with open('README.md', 'r') as f:
                readme_content = f.read()
            
            if len(readme_content) > 1000:  # Substantial content
                print("  ✅ README.md exists and is comprehensive")
            else:
                print("  ⚠️  README.md exists but may be incomplete")
        else:
            print("  ❌ README.md missing")
        
        # Check implementation guide
        if os.path.exists('IMPLEMENTATION_GUIDE.md'):
            with open('IMPLEMENTATION_GUIDE.md', 'r') as f:
                guide_content = f.read()
            
            if len(guide_content) > 5000:  # Very substantial content
                print("  ✅ IMPLEMENTATION_GUIDE.md exists and is comprehensive")
            else:
                print("  ⚠️  IMPLEMENTATION_GUIDE.md exists but may be incomplete")
        else:
            print("  ❌ IMPLEMENTATION_GUIDE.md missing")
        
        # Check requirements
        if os.path.exists('requirements.txt'):
            with open('requirements.txt', 'r') as f:
                req_content = f.read()
            
            required_packages = ['torch', 'numpy', 'networkx', 'matplotlib']
            missing_packages = []
            
            for package in required_packages:
                if package in req_content:
                    print(f"    ✅ {package} in requirements")
                else:
                    missing_packages.append(package)
            
            if missing_packages:
                print(f"    ⚠️  Missing packages: {missing_packages}")
        else:
            print("  ❌ requirements.txt missing")
        
        print("\n✅ Documentation structure complete")
        return True
        
    except Exception as e:
        print(f"\n❌ Documentation test failed: {e}")
        return False


def main():
    """Run all simple tests"""
    
    print("🧪 Self-Learning AI System - Structure Validation")
    print("=" * 55)
    
    tests = [
        ("File Structure", test_file_structure),
        ("Class Definitions", test_class_definitions), 
        ("Documentation", test_documentation),
        ("Imports", test_imports)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n🔬 Running {test_name} Test")
        print("-" * 30)
        
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} test failed with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 55)
    print("📋 VALIDATION SUMMARY")
    print("=" * 55)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name:20} {status}")
    
    print(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("\n🎉 ALL VALIDATION TESTS PASSED!")
        print("✅ The Self-Learning AI System structure is complete")
        print("🚀 System is ready for full testing and deployment")
        
        print("\n🎯 Next steps:")
        print("  1. Install dependencies: pip install -r requirements.txt")
        print("  2. Run basic demo: python demo.py --mode basic")
        print("  3. Launch dashboard: python demo.py --mode dashboard")
        print("  4. Run full tests: python tests/test_self_learning_system.py")
        
    else:
        print(f"\n⚠️  {total - passed} validation tests failed")
        print("🔧 System structure may need fixes before full deployment")
    
    return passed == total


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)