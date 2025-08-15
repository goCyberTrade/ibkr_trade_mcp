#!/usr/bin/env python3
"""
Test script for DeepSeek and Qwen LLM integration.

This script tests the newly added DeepSeek and Qwen support in the LLM service.
"""

import os
import sys
import asyncio
import json
from typing import Dict, Any

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from services.llm import make_llm_api_call, setup_api_keys, prepare_params
from utils.config import config
from utils.logger import logger

async def test_model(model_name: str, test_message: str = "Hello! Please respond with a brief introduction about yourself.") -> Dict[str, Any]:
    """Test a specific model with a simple message."""
    try:
        logger.info(f"Testing model: {model_name}")
        
        messages = [
            {"role": "user", "content": test_message}
        ]
        
        # Test parameter preparation first
        params = prepare_params(
            messages=messages,
            model_name=model_name,
            temperature=0.7,
            max_tokens=100
        )
        
        logger.info(f"Prepared parameters for {model_name}:")
        logger.info(f"  API Base: {params.get('api_base', 'Default')}")
        logger.info(f"  Has API Key: {'Yes' if params.get('api_key') else 'No'}")
        logger.info(f"  Temperature: {params.get('temperature')}")
        logger.info(f"  Top P: {params.get('top_p')}")
        
        # If no API key is available, skip actual API call
        if not params.get('api_key'):
            logger.warning(f"No API key available for {model_name}, skipping actual API call")
            return {
                "status": "skipped",
                "reason": "No API key configured",
                "model": model_name,
                "params_prepared": True
            }
        
        # Make actual API call
        response = await make_llm_api_call(
            messages=messages,
            model_name=model_name,
            temperature=0.7,
            max_tokens=100
        )
        
        # Extract response text
        if hasattr(response, 'choices') and response.choices:
            content = response.choices[0].message.content
            logger.info(f"Response from {model_name}: {content[:100]}...")
            return {
                "status": "success",
                "model": model_name,
                "response_length": len(content),
                "response_preview": content[:100]
            }
        else:
            logger.error(f"Unexpected response format from {model_name}")
            return {
                "status": "error",
                "model": model_name,
                "error": "Unexpected response format"
            }
            
    except Exception as e:
        logger.error(f"Error testing {model_name}: {str(e)}")
        return {
            "status": "error",
            "model": model_name,
            "error": str(e)
        }

async def test_fallback_mapping():
    """Test fallback model mapping."""
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
    
    logger.info("Testing fallback model mapping:")
    for model in test_models:
        fallback = get_openrouter_fallback(model)
        logger.info(f"  {model} -> {fallback or 'No fallback'}")

def check_configuration():
    """Check current configuration for DeepSeek and Qwen."""
    logger.info("Checking configuration...")
    
    # Check if API keys are configured
    deepseek_key = getattr(config, 'DEEPSEEK_API_KEY', None)
    qwen_key = getattr(config, 'QWEN_API_KEY', None)
    
    logger.info(f"DeepSeek API Key configured: {'Yes' if deepseek_key else 'No'}")
    logger.info(f"Qwen API Key configured: {'Yes' if qwen_key else 'No'}")
    
    # Check environment variables
    env_deepseek = os.getenv('DEEPSEEK_API_KEY')
    env_qwen = os.getenv('QWEN_API_KEY')
    
    logger.info(f"DEEPSEEK_API_KEY environment variable: {'Set' if env_deepseek else 'Not set'}")
    logger.info(f"QWEN_API_KEY environment variable: {'Set' if env_qwen else 'Not set'}")
    
    return {
        "config_deepseek": bool(deepseek_key),
        "config_qwen": bool(qwen_key),
        "env_deepseek": bool(env_deepseek),
        "env_qwen": bool(env_qwen)
    }

async def main():
    """Main test function."""
    logger.info("Starting DeepSeek and Qwen integration tests...")
    
    # Setup API keys
    setup_api_keys()
    
    # Check configuration
    config_status = check_configuration()
    
    # Test fallback mapping
    await test_fallback_mapping()
    
    # Test models
    test_models = [
        "deepseek/deepseek-chat",
        "deepseek/deepseek-coder",
        "qwen/qwen-plus", 
        "qwen/qwen-turbo",
        "qwen/qwen-max"
    ]
    
    results = []
    for model in test_models:
        result = await test_model(model)
        results.append(result)
        
        # Small delay between tests
        await asyncio.sleep(1)
    
    # Print summary
    logger.info("\n" + "="*50)
    logger.info("TEST SUMMARY")
    logger.info("="*50)
    
    logger.info("Configuration Status:")
    for key, value in config_status.items():
        logger.info(f"  {key}: {'✓' if value else '✗'}")
    
    logger.info("\nModel Test Results:")
    for result in results:
        status_icon = {
            "success": "✓",
            "error": "✗", 
            "skipped": "○"
        }.get(result["status"], "?")
        
        logger.info(f"  {status_icon} {result['model']}: {result['status']}")
        if result["status"] == "error":
            logger.info(f"    Error: {result.get('error', 'Unknown error')}")
        elif result["status"] == "skipped":
            logger.info(f"    Reason: {result.get('reason', 'Unknown reason')}")
        elif result["status"] == "success":
            logger.info(f"    Response length: {result.get('response_length', 0)} chars")
    
    # Provide setup instructions if needed
    if not any([config_status["config_deepseek"], config_status["config_qwen"], 
                config_status["env_deepseek"], config_status["env_qwen"]]):
        logger.info("\n" + "="*50)
        logger.info("SETUP INSTRUCTIONS")
        logger.info("="*50)
        logger.info("To test DeepSeek and Qwen integration, set up API keys:")
        logger.info("")
        logger.info("For DeepSeek:")
        logger.info("  1. Get API key from: https://platform.deepseek.com/")
        logger.info("  2. Set environment variable: export DEEPSEEK_API_KEY='your_key'")
        logger.info("")
        logger.info("For Qwen:")
        logger.info("  1. Get API key from: https://dashscope.aliyun.com/")
        logger.info("  2. Set environment variable: export QWEN_API_KEY='your_key'")
        logger.info("")
        logger.info("Then run this test script again.")

if __name__ == "__main__":
    asyncio.run(main())