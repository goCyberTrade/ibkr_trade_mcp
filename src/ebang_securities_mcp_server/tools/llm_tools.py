from typing import List, Optional, Dict, Any
from pydantic import Field
from mcp import types
from mcp.server.fastmcp import FastMCP
from loguru import logger

from ebang_securities_mcp_server.utils.llm import (
    llm_manager, 
    get_llm_response, 
    analyze_market_data, 
    generate_trading_strategy
)


def chat_with_llm(
    message: str = Field(description="要发送给LLM的消息内容"),
    client_name: Optional[str] = Field(description="指定使用的LLM客户端名称，如 'deepseek-chat', 'qwen-plus' 等。不指定则使用默认客户端", default=None),
    temperature: Optional[float] = Field(description="控制回复的随机性，0.0-1.0，数值越高越随机", default=None),
    max_tokens: Optional[int] = Field(description="回复的最大token数量", default=None)
) -> str:
    """
    与LLM进行对话交流
    
    支持的LLM客户端：
    - DeepSeek: deepseek-chat, deepseek-coder
    - Qwen: qwen-turbo, qwen-plus, qwen-max
    
    Args:
        message: 要发送的消息
        client_name: LLM客户端名称（可选）
        temperature: 控制随机性（可选）
        max_tokens: 最大token数（可选）
        
    Returns:
        LLM的回复内容
    """
    try:
        kwargs = {}
        if temperature is not None:
            kwargs['temperature'] = temperature
        if max_tokens is not None:
            kwargs['max_tokens'] = max_tokens
            
        response = get_llm_response(message, client_name, **kwargs)
        logger.info(f"LLM对话成功，客户端: {client_name or '默认'}")
        return response
        
    except Exception as e:
        error_msg = f"LLM对话失败: {str(e)}"
        logger.error(error_msg)
        return error_msg


def analyze_financial_data(
    data: str = Field(description="要分析的金融数据，可以是账户信息、持仓数据、交易记录等"),
    analysis_type: str = Field(description="分析类型，如 'account', 'position', 'trading', 'performance' 等", default="general"),
    client_name: Optional[str] = Field(description="指定使用的LLM客户端名称", default=None)
) -> str:
    """
    使用LLM分析金融数据
    
    可以分析各种类型的金融数据：
    - account: 账户信息分析
    - position: 持仓分析
    - trading: 交易记录分析
    - performance: 业绩表现分析
    - market: 市场数据分析
    - general: 通用分析
    
    Args:
        data: 要分析的数据内容
        analysis_type: 分析类型
        client_name: LLM客户端名称（可选）
        
    Returns:
        详细的分析报告
    """
    try:
        analysis_result = analyze_market_data(data, analysis_type, client_name)
        logger.info(f"金融数据分析完成，类型: {analysis_type}")
        return analysis_result
        
    except Exception as e:
        error_msg = f"金融数据分析失败: {str(e)}"
        logger.error(error_msg)
        return error_msg


def create_trading_strategy(
    account_info: str = Field(description="账户信息，包括资金状况、持仓情况等"),
    market_condition: str = Field(description="市场状况描述，包括当前市场趋势、重要事件等"),
    risk_level: str = Field(description="风险偏好水平，如 'conservative', 'moderate', 'aggressive'", default="moderate"),
    investment_horizon: str = Field(description="投资时间范围，如 'short-term', 'medium-term', 'long-term'", default="medium-term"),
    client_name: Optional[str] = Field(description="指定使用的LLM客户端名称", default=None)
) -> str:
    """
    基于账户和市场情况生成交易策略
    
    Args:
        account_info: 账户信息
        market_condition: 市场状况
        risk_level: 风险偏好（保守/适中/激进）
        investment_horizon: 投资时间范围（短期/中期/长期）
        client_name: LLM客户端名称（可选）
        
    Returns:
        详细的交易策略建议
    """
    try:
        # 构建更详细的市场条件描述
        enhanced_market_condition = f"""
市场状况: {market_condition}
风险偏好: {risk_level}
投资时间范围: {investment_horizon}
        """
        
        strategy = generate_trading_strategy(account_info, enhanced_market_condition, client_name)
        logger.info(f"交易策略生成完成，风险级别: {risk_level}")
        return strategy
        
    except Exception as e:
        error_msg = f"交易策略生成失败: {str(e)}"
        logger.error(error_msg)
        return error_msg


def list_available_llm_clients() -> str:
    """
    列出所有可用的LLM客户端
    
    Returns:
        可用客户端列表和详细信息
    """
    try:
        clients = llm_manager.list_clients()
        default_client = llm_manager.default_client
        
        if not clients:
            return """
当前没有可用的LLM客户端。

请设置以下环境变量之一来配置LLM：
- DEEPSEEK_API_KEY: 用于DeepSeek模型
- QWEN_API_KEY 或 DASHSCOPE_API_KEY: 用于Qwen模型

配置后重启服务即可使用LLM功能。
"""
        
        result = f"可用的LLM客户端（共{len(clients)}个）:\n\n"
        
        for client in clients:
            status = " (默认)" if client == default_client else ""
            result += f"• {client}{status}\n"
        
        result += f"\n默认客户端: {default_client or '未设置'}"
        result += "\n\n支持的功能："
        result += "\n- chat_with_llm: 与LLM对话"
        result += "\n- analyze_financial_data: 分析金融数据"
        result += "\n- create_trading_strategy: 生成交易策略"
        
        logger.info("LLM客户端列表查询成功")
        return result
        
    except Exception as e:
        error_msg = f"获取LLM客户端列表失败: {str(e)}"
        logger.error(error_msg)
        return error_msg


def get_llm_config_help() -> str:
    """
    获取LLM配置帮助信息
    
    Returns:
        详细的配置说明
    """
    help_text = """
# LLM配置帮助

## 支持的LLM提供商

### 1. DeepSeek
- 模型: deepseek-chat, deepseek-coder
- API地址: https://api.deepseek.com/v1
- 环境变量: DEEPSEEK_API_KEY
- 获取API密钥: https://platform.deepseek.com/

### 2. Qwen (通义千问)
- 模型: qwen-turbo, qwen-plus, qwen-max
- API地址: https://dashscope.aliyuncs.com/api/v1
- 环境变量: QWEN_API_KEY 或 DASHSCOPE_API_KEY
- 获取API密钥: https://dashscope.aliyun.com/

## 配置方法

### Linux/Mac:
```bash
export DEEPSEEK_API_KEY="your_deepseek_api_key"
export QWEN_API_KEY="your_qwen_api_key"
```

### Windows:
```cmd
set DEEPSEEK_API_KEY=your_deepseek_api_key
set QWEN_API_KEY=your_qwen_api_key
```

## 推荐配置

- **金融分析**: 推荐使用 qwen-plus 或 deepseek-chat
- **代码生成**: 推荐使用 deepseek-coder
- **快速响应**: 推荐使用 qwen-turbo

配置完成后重启MCP服务器即可使用LLM功能。
"""
    
    logger.info("LLM配置帮助查询成功")
    return help_text


# 导出所有工具
tools = [
    chat_with_llm,
    analyze_financial_data,
    create_trading_strategy,
    list_available_llm_clients,
    get_llm_config_help
]


if __name__ == "__main__":
    # 测试工具
    print("测试LLM工具...")
    
    # 测试客户端列表
    print("\n1. 可用客户端:")
    print(list_available_llm_clients())
    
    # 测试配置帮助
    print("\n2. 配置帮助:")
    print(get_llm_config_help())
    
    # 如果有可用客户端，测试对话功能
    if llm_manager.clients:
        print("\n3. 测试对话:")
        try:
            response = chat_with_llm("你好，请简单介绍一下你的能力")
            print(f"LLM回复: {response[:200]}...")
        except Exception as e:
            print(f"对话测试失败: {e}")
    else:
        print("\n3. 跳过对话测试（未配置LLM客户端）")