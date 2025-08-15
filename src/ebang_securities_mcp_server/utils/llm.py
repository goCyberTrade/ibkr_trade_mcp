import json
import requests
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum
from loguru import logger


class LLMProvider(Enum):
    """支持的 LLM 提供商"""
    DEEPSEEK = "deepseek"
    QWEN = "qwen"


@dataclass
class LLMConfig:
    """LLM 配置类"""
    provider: LLMProvider
    api_key: str
    base_url: str
    model: str
    max_tokens: int = 4000
    temperature: float = 0.7
    timeout: int = 30


class LLMClient:
    """统一的 LLM 客户端类"""
    
    def __init__(self, config: LLMConfig):
        self.config = config
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json"
        })
    
    def chat_completion(self, messages: List[Dict[str, str]], **kwargs) -> Dict[str, Any]:
        """
        发送聊天完成请求
        
        Args:
            messages: 对话消息列表，格式为 [{"role": "user", "content": "..."}]
            **kwargs: 额外的参数，如 temperature, max_tokens 等
            
        Returns:
            API 响应结果
        """
        try:
            payload = self._build_payload(messages, **kwargs)
            response = self.session.post(
                f"{self.config.base_url}/chat/completions",
                json=payload,
                timeout=self.config.timeout
            )
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logger.error(f"LLM API 请求失败: {e}")
            raise Exception(f"LLM API 请求失败: {e}")
        except Exception as e:
            logger.error(f"LLM 处理失败: {e}")
            raise Exception(f"LLM 处理失败: {e}")
    
    def _build_payload(self, messages: List[Dict[str, str]], **kwargs) -> Dict[str, Any]:
        """构建 API 请求载荷"""
        payload = {
            "model": self.config.model,
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", self.config.max_tokens),
            "temperature": kwargs.get("temperature", self.config.temperature),
            "stream": kwargs.get("stream", False)
        }
        
        # 根据不同提供商调整参数
        if self.config.provider == LLMProvider.DEEPSEEK:
            # DeepSeek 特定参数
            payload["top_p"] = kwargs.get("top_p", 0.95)
            payload["frequency_penalty"] = kwargs.get("frequency_penalty", 0.0)
            payload["presence_penalty"] = kwargs.get("presence_penalty", 0.0)
        elif self.config.provider == LLMProvider.QWEN:
            # Qwen 特定参数
            payload["top_p"] = kwargs.get("top_p", 0.8)
            payload["repetition_penalty"] = kwargs.get("repetition_penalty", 1.1)
        
        return payload
    
    def get_response_text(self, response: Dict[str, Any]) -> str:
        """从 API 响应中提取文本内容"""
        try:
            return response["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError) as e:
            logger.error(f"解析 LLM 响应失败: {e}")
            raise Exception(f"解析 LLM 响应失败: {e}")


class LLMManager:
    """LLM 管理器，支持多个 LLM 提供商"""
    
    def __init__(self):
        self.clients: Dict[str, LLMClient] = {}
        self.default_client: Optional[str] = None
    
    def add_client(self, name: str, config: LLMConfig, is_default: bool = False):
        """添加 LLM 客户端"""
        self.clients[name] = LLMClient(config)
        if is_default or self.default_client is None:
            self.default_client = name
        logger.info(f"添加 LLM 客户端: {name} ({config.provider.value})")
    
    def get_client(self, name: Optional[str] = None) -> LLMClient:
        """获取 LLM 客户端"""
        client_name = name or self.default_client
        if client_name not in self.clients:
            raise ValueError(f"LLM 客户端 '{client_name}' 不存在")
        return self.clients[client_name]
    
    def list_clients(self) -> List[str]:
        """列出所有可用的客户端"""
        return list(self.clients.keys())
    
    def chat(self, messages: List[Dict[str, str]], client_name: Optional[str] = None, **kwargs) -> str:
        """便捷的聊天方法"""
        client = self.get_client(client_name)
        response = client.chat_completion(messages, **kwargs)
        return client.get_response_text(response)


# 预设配置
DEEPSEEK_CONFIGS = {
    "deepseek-chat": LLMConfig(
        provider=LLMProvider.DEEPSEEK,
        api_key="",  # 需要用户提供
        base_url="https://api.deepseek.com/v1",
        model="deepseek-chat",
        max_tokens=4000,
        temperature=0.7
    ),
    "deepseek-coder": LLMConfig(
        provider=LLMProvider.DEEPSEEK,
        api_key="",  # 需要用户提供
        base_url="https://api.deepseek.com/v1",
        model="deepseek-coder",
        max_tokens=4000,
        temperature=0.1  # 编程任务使用较低温度
    )
}

QWEN_CONFIGS = {
    "qwen-turbo": LLMConfig(
        provider=LLMProvider.QWEN,
        api_key="",  # 需要用户提供
        base_url="https://dashscope.aliyuncs.com/api/v1",
        model="qwen-turbo",
        max_tokens=4000,
        temperature=0.7
    ),
    "qwen-plus": LLMConfig(
        provider=LLMProvider.QWEN,
        api_key="",  # 需要用户提供
        base_url="https://dashscope.aliyuncs.com/api/v1",
        model="qwen-plus",
        max_tokens=4000,
        temperature=0.7
    ),
    "qwen-max": LLMConfig(
        provider=LLMProvider.QWEN,
        api_key="",  # 需要用户提供
        base_url="https://dashscope.aliyuncs.com/api/v1",
        model="qwen-max",
        max_tokens=4000,
        temperature=0.7
    )
}


def create_llm_manager_from_env() -> LLMManager:
    """从环境变量创建 LLM 管理器"""
    import os
    
    manager = LLMManager()
    
    # 配置 DeepSeek
    deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
    if deepseek_api_key:
        for name, config in DEEPSEEK_CONFIGS.items():
            config.api_key = deepseek_api_key
            manager.add_client(name, config, name == "deepseek-chat")
    
    # 配置 Qwen
    qwen_api_key = os.getenv("QWEN_API_KEY") or os.getenv("DASHSCOPE_API_KEY")
    if qwen_api_key:
        for name, config in QWEN_CONFIGS.items():
            config.api_key = qwen_api_key
            manager.add_client(name, config, name == "qwen-plus" and not deepseek_api_key)
    
    if not manager.clients:
        logger.warning("未配置任何 LLM 客户端，请设置 DEEPSEEK_API_KEY 或 QWEN_API_KEY 环境变量")
    
    return manager


# 全局 LLM 管理器实例
llm_manager = create_llm_manager_from_env()


def get_llm_response(prompt: str, client_name: Optional[str] = None, **kwargs) -> str:
    """便捷函数：获取 LLM 响应"""
    messages = [{"role": "user", "content": prompt}]
    return llm_manager.chat(messages, client_name, **kwargs)


def analyze_market_data(data: str, analysis_type: str = "general", client_name: Optional[str] = None) -> str:
    """使用 LLM 分析市场数据"""
    prompt = f"""
作为一个专业的金融分析师，请分析以下市场数据：

数据类型: {analysis_type}
数据内容:
{data}

请提供详细的分析，包括：
1. 数据概述
2. 关键指标分析
3. 市场趋势判断
4. 风险评估
5. 投资建议

请用中文回复，保持专业和客观。
"""
    return get_llm_response(prompt, client_name, temperature=0.3)


def generate_trading_strategy(account_info: str, market_condition: str, client_name: Optional[str] = None) -> str:
    """使用 LLM 生成交易策略"""
    prompt = f"""
作为一个经验丰富的交易策略师，请基于以下信息制定交易策略：

账户信息:
{account_info}

市场状况:
{market_condition}

请提供：
1. 策略概述
2. 具体交易建议
3. 风险控制措施
4. 预期收益和风险评估
5. 执行时间建议

请用中文回复，确保策略具有可操作性。
"""
    return get_llm_response(prompt, client_name, temperature=0.2)


if __name__ == "__main__":
    # 测试代码
    import os
    
    # 设置测试 API 密钥
    os.environ["DEEPSEEK_API_KEY"] = "your_deepseek_api_key"
    os.environ["QWEN_API_KEY"] = "your_qwen_api_key"
    
    # 重新创建管理器
    global llm_manager
    llm_manager = create_llm_manager_from_env()
    
    # 测试基本功能
    try:
        response = get_llm_response("你好，请介绍一下你的能力")
        print(f"LLM 响应: {response}")
    except Exception as e:
        print(f"测试失败: {e}")