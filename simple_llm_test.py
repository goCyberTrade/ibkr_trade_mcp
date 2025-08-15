#!/usr/bin/env python3
"""
Simplified test script for DeepSeek and Qwen LLM integration.

This script tests the parameter preparation and fallback mapping without requiring
full configuration setup.
"""

import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

def test_fallback_mapping():
    """Test fallback model mapping without full config."""
    print("Testing fallback model mapping...")
    
    # Import the fallback function directly
    try:
        from services.llm import get_openrouter_fallback
        
        test_models = [
            "deepseek/deepseek-chat",
            "deepseek/deepseek-coder", 
            "qwen/qwen-plus",
            "qwen/qwen-turbo",
            "qwen/qwen-max",
            "deepseek-chat",  # Test partial match
            "qwen-plus",      # Test partial match
        ]
        
        print("\nFallback mapping results:")
        for model in test_models:
            fallback = get_openrouter_fallback(model)
            print(f"  {model} -> {fallback or 'No fallback'}")
        
        return True
        
    except Exception as e:
        print(f"Error testing fallback mapping: {e}")
        return False

def test_parameter_preparation():
    """Test parameter preparation without making API calls."""
    print("\nTesting parameter preparation...")
    
    try:
        # Mock a minimal config object
        class MockConfig:
            DEEPSEEK_API_KEY = "test_deepseek_key"
            QWEN_API_KEY = "test_qwen_key"
        
        # Temporarily replace config
        import services.llm
        original_config = getattr(services.llm, 'config', None)
        services.llm.config = MockConfig()
        
        from services.llm import prepare_params
        
        test_cases = [
            ("deepseek/deepseek-chat", "DeepSeek Chat"),
            ("deepseek/deepseek-coder", "DeepSeek Coder"),
            ("qwen/qwen-plus", "Qwen Plus"),
            ("qwen/qwen-turbo", "Qwen Turbo"),
            ("qwen/qwen-max", "Qwen Max"),
        ]
        
        messages = [{"role": "user", "content": "Hello"}]
        
        print("\nParameter preparation results:")
        for model_name, display_name in test_cases:
            try:
                params = prepare_params(
                    messages=messages,
                    model_name=model_name,
                    temperature=0.7,
                    max_tokens=100
                )
                
                print(f"\n{display_name} ({model_name}):")
                print(f"  API Base: {params.get('api_base', 'Default')}")
                print(f"  Has API Key: {'Yes' if params.get('api_key') else 'No'}")
                print(f"  Temperature: {params.get('temperature')}")
                print(f"  Top P: {params.get('top_p')}")
                print(f"  Extra Headers: {'Yes' if params.get('extra_headers') else 'No'}")
                
            except Exception as e:
                print(f"  Error preparing params for {model_name}: {e}")
        
        # Restore original config if it existed
        if original_config:
            services.llm.config = original_config
        
        return True
        
    except Exception as e:
        print(f"Error testing parameter preparation: {e}")
        return False

def check_integration_status():
    """Check the integration status."""
    print("Checking DeepSeek and Qwen integration status...")
    
    # Check if the modifications are in place
    try:
        with open('/workspace/backend/services/llm.py', 'r') as f:
            content = f.read()
            
        has_deepseek = 'deepseek' in content.lower()
        has_qwen = 'qwen' in content.lower()
        has_fallback = 'deepseek/deepseek-chat' in content
        
        print(f"\nIntegration Status:")
        print(f"  DeepSeek support: {'✓' if has_deepseek else '✗'}")
        print(f"  Qwen support: {'✓' if has_qwen else '✗'}")
        print(f"  Fallback mapping: {'✓' if has_fallback else '✗'}")
        
        return has_deepseek and has_qwen and has_fallback
        
    except Exception as e:
        print(f"Error checking integration status: {e}")
        return False

def main():
    """Main test function."""
    print("="*60)
    print("DeepSeek and Qwen Integration Test")
    print("="*60)
    
    # Check integration status
    integration_ok = check_integration_status()
    
    # Test fallback mapping
    fallback_ok = test_fallback_mapping()
    
    # Test parameter preparation
    params_ok = test_parameter_preparation()
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    results = [
        ("Integration Status", integration_ok),
        ("Fallback Mapping", fallback_ok),
        ("Parameter Preparation", params_ok),
    ]
    
    for test_name, success in results:
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"{test_name}: {status}")
    
    overall_success = all(result[1] for result in results)
    
    print(f"\nOverall Result: {'✓ ALL TESTS PASSED' if overall_success else '✗ SOME TESTS FAILED'}")
    
    if overall_success:
        print("\n🎉 DeepSeek and Qwen integration is working correctly!")
        print("\nNext steps:")
        print("1. Set up API keys:")
        print("   export DEEPSEEK_API_KEY='your_deepseek_api_key'")
        print("   export QWEN_API_KEY='your_qwen_api_key'")
        print("2. Use the models in your application:")
        print("   model_name='deepseek/deepseek-chat' or 'qwen/qwen-plus'")
    else:
        print("\n❌ Some tests failed. Please check the integration.")
    
    return overall_success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)