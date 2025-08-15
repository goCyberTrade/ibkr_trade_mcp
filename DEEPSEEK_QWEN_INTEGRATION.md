# DeepSeek 和 Qwen 模型集成

本文档说明如何在 Suna 项目中使用新集成的 DeepSeek 和 Qwen 大语言模型。

## 支持的模型

### DeepSeek 模型
- `deepseek/deepseek-chat` - 通用对话模型
- `deepseek/deepseek-coder` - 专门用于代码生成和编程任务的模型

### Qwen 模型  
- `qwen/qwen-turbo` - 快速响应模型
- `qwen/qwen-plus` - 平衡性能和质量的模型
- `qwen/qwen-max` - 最高质量的模型

## 配置方法

### 1. 获取 API 密钥

#### DeepSeek
1. 访问 [DeepSeek 平台](https://platform.deepseek.com/)
2. 注册账户并获取 API 密钥
3. 查看 [DeepSeek API 文档](https://platform.deepseek.com/api-docs/)

#### Qwen
1. 访问 [阿里云灵积平台](https://dashscope.aliyun.com/)
2. 注册账户并获取 API 密钥  
3. 查看 [Qwen API 文档](https://help.aliyun.com/zh/dashscope/)

### 2. 设置环境变量

#### 方法 1: 使用环境变量
```bash
# DeepSeek
export DEEPSEEK_API_KEY="your_deepseek_api_key_here"

# Qwen
export QWEN_API_KEY="your_qwen_api_key_here"
```

#### 方法 2: 使用 .env 文件
在项目根目录的 `.env` 文件中添加：
```env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
QWEN_API_KEY=your_qwen_api_key_here
```

#### 方法 3: 使用 setup.py 配置向导
运行项目的设置脚本：
```bash
python setup.py
```
在 LLM 提供商选择中，选择：
- 选项 5: DeepSeek
- 选项 6: Qwen

## 使用方法

### 1. 在代码中使用

```python
from backend.services.llm import make_llm_api_call

# 使用 DeepSeek Chat 模型
messages = [{"role": "user", "content": "你好，请介绍一下你自己"}]
response = await make_llm_api_call(
    messages=messages,
    model_name="deepseek/deepseek-chat",
    temperature=0.7,
    max_tokens=1000
)

# 使用 Qwen Plus 模型
response = await make_llm_api_call(
    messages=messages,
    model_name="qwen/qwen-plus", 
    temperature=0.7,
    max_tokens=1000
)
```

### 2. 设置为默认模型

在配置中设置 `MODEL_TO_USE` 环境变量：
```bash
# 使用 DeepSeek Chat 作为默认模型
export MODEL_TO_USE="deepseek/deepseek-chat"

# 或使用 Qwen Plus 作为默认模型  
export MODEL_TO_USE="qwen/qwen-plus"
```

## 模型特性和参数

### DeepSeek 模型特性
- **API 地址**: `https://api.deepseek.com/v1`
- **默认 top_p**: 0.95
- **支持的参数**: temperature, max_tokens, top_p, frequency_penalty, presence_penalty
- **特点**: 支持中英文对话，代码生成能力强

### Qwen 模型特性
- **API 地址**: `https://dashscope.aliyuncs.com/api/v1`
- **默认 top_p**: 0.8
- **支持的参数**: temperature, max_tokens, top_p, repetition_penalty
- **特点**: 中文理解能力强，多模态支持

## Fallback 支持

当主要模型不可用时，系统会自动使用 OpenRouter 作为备用：

- `deepseek/deepseek-chat` → `openrouter/deepseek/deepseek-chat`
- `deepseek/deepseek-coder` → `openrouter/deepseek/deepseek-coder`
- `qwen/qwen-plus` → `openrouter/qwen/qwen-plus`
- `qwen/qwen-turbo` → `openrouter/qwen/qwen-turbo`
- `qwen/qwen-max` → `openrouter/qwen/qwen-max`

## 测试集成

运行测试脚本验证集成是否正常：

```bash
python test_llm_integration.py
```

这个脚本会：
1. 检查配置状态
2. 测试参数准备
3. 测试 fallback 映射
4. 尝试调用各个模型（如果有 API 密钥）
5. 提供详细的测试报告

## 故障排除

### 常见问题

1. **API 密钥未生效**
   - 确认环境变量已正确设置
   - 重启应用程序以加载新的环境变量

2. **API 调用失败**
   - 检查 API 密钥是否有效
   - 确认账户余额充足
   - 检查网络连接

3. **模型不可用**
   - 检查模型名称拼写是否正确
   - 确认所选模型在对应平台可用

### 调试模式

启用调试日志查看详细信息：
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## 费用说明

- **DeepSeek**: 按 token 计费，具体价格请查看官方定价
- **Qwen**: 按调用次数或 token 计费，支持免费额度

建议在生产环境使用前，先在测试环境验证费用和性能。

## 更新日志

- **v1.0.0** (2024-08-15)
  - 添加 DeepSeek 模型支持
  - 添加 Qwen 模型支持
  - 集成 fallback 机制
  - 添加配置向导支持
  - 创建测试脚本

## 贡献

如果你发现问题或有改进建议，请提交 Issue 或 Pull Request。