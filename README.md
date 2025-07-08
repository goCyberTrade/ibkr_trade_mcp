![image](https://github.com/goCyberTrade/ibkr_trade_mcp/blob/main/pics/ebtech.png)
# ibkr_trade_mcp
# IBKR Trading MCP Tools


# Overview
This project implements MCP (Market Connectivity Platform) tools for interacting with IBKR (Interactive Brokers) trading systems, including account querying, order placement, position management, and other essential trading functionalities. This project is built on top of Interactive Brokers [WEB API.](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-doc/#introduction-0)


## 1. Environment Setup

### 1.1 Install Python Environment
- Download Python installer from: [Python Official Downloads](https://www.python.org/downloads/)
- Recommended version: **Python 3.10.X**
- Verify installation with:
  ```bash
  python --version
  pip --version
  ```

### 1.2 Install UV Tool
```bash
pip install uv
```
Verify installation:
```bash
uv --version
```

### 1.3 Install JDK
- Download the latest JDK from: [Oracle JDK Downloads](https://www.oracle.com/java/technologies/downloads/#java11)
- Verify installation:
  ```bash
  java -version
  ```


## 2. Broker MCP Tool Installation & Startup

### 2.1 IBKR MCP Server Installation
1. Build the project in the repository root:
   ```bash
   python -m build
   ```
2. Install the generated wheel package:
   ```bash
   pip install dist/ebang_securities_mcp_server-x.x.x-py3-none-any.whl
   ```
3. Verify installation:
   ```bash
   pip show ebang-securities-mcp-server
   ```

### 2.2 Start MCP Server
#### Option 1: SSE Mode (Recommended)
**Windows**:
```bash
set IB_AUTO_RUN=True&&uv run ebang-securities-mcp-server
```

**Linux/Mac**:
```bash
export IB_AUTO_RUN=True&&uv run ebang-securities-mcp-server
```

**Notes**:
- The first startup will download the IB Gateway automatically (requires stable internet connection).
- Register an IBKR demo account at: [IBKR Demo Account](https://www.interactivebrokers.com.sg/Universal/Application?ft=T)
- Authenticate your IBKR account via: [http://localhost:5000](http://localhost:5000)

#### Option 2: STDIO Mode
Configure in your application code with:
```json
{
  "mcpServers": {
    "stdio_trade": {
      "disabled": true,
      "timeout": 60,
      "type": "stdio",
      "command": "uv",
      "args": [
        "run",
        "ebang-securities-mcp-server",
        "--transport",
        "stdio"
      ],
      "env": {
        "IB_AUTO_RUN": "True"
      }
    }
  }
}
```


## 3. Using MCP Tools in Development Environments

### 3.1 Cursor IDE Integration
1. Download Cursor from: [Cursor Official](https://www.cursor.com/cn)
2. Create an MCP Server configuration:
   ```json
   {
     "mcpServers": {
       "tradeMCP": {
         "autoApprove": [],
         "disabled": false,
         "timeout": 60,
         "type": "sse",
         "url": "http://127.0.0.1:8000/sse"
       }
     }
   }
   ```
3. Enable the configuration and ensure status is green.
   ![image](https://github.com/goCyberTrade/ibkr_trade_mcp/blob/main/pics/cursor_tools.png)
4. Open the chat interface (`Ctrl+L` by default) to use the tools.

   ![image](https://github.com/goCyberTrade/ibkr_trade_mcp/blob/main/pics/cursor.gif)

### 3.2 VS Code Integration
1. Download VS Code from: [VS Code Official](https://code.visualstudio.com/)
2. Install the "Cline" extension from the Marketplace.
   ![image](https://github.com/goCyberTrade/ibkr_trade_mcp/blob/main/pics/vs_cline.png)
4. Configure your AI model API key (e.g., DeepSeek).
   ![image](https://github.com/goCyberTrade/ibkr_trade_mcp/blob/main/pics/vs_model.png)
6. Configure MCP service with:
   ```json
   {
     "mcpServers": {
       "tradeMCP": {
         "autoApprove": [],
         "disabled": false,
         "timeout": 60,
         "type": "sse",
         "url": "http://127.0.0.1:8000/sse"
       }
     }
   }
   ```
7. Enable the configuration and ensure status is green.
   ![image](https://github.com/goCyberTrade/ibkr_trade_mcp/blob/main/pics/vs_tools.png)
9. Use the chat interface for tool interactions.
   ![image](https://github.com/goCyberTrade/ibkr_trade_mcp/blob/main/pics/vs_test.gif)
11. Optionally enable "Auto-approve" to skip confirmation for future tool calls.

