# ibkr_trade_mcp
Implement MCP tools related to IBKR trading, including tools for querying accounts, placing orders, querying positions, etc.
1.环境安装
(1).安装python环境
到python官方下载地址:https://www.python.org/downloads/下载python安装包，建议使用3.10.X版本python
安装完成后使用以下命令确认是否安装成功:
python --version
pip --version
(2).安装uv
使用命令:pip install uv   安装uv，安装完成后使用以下命令确认是否安装成功:
uv --version
(3).安装JDK
下载最近的安装包，地址:https://www.oracle.com/java/technologies/downloads/#java11
安装完成以后使用命令:java -version 确认是否安装成功
2.券商MCP工具安装以及启动
(1).IB
在本工程目录下编译工程:
python -m build
编译完毕后在dist/目录下会生产whl文件，使用pip install ebang_securities_mcp_server-x.x.x-py3-none-any.whl安装MCP服务
- 安装完毕后使用:pip show ebang-securities-mcp-server命令确认是否正常安装完毕

启动服务的方式目前有两种SSE和STDIO
1. SSE方式启动
Widows环境运行命令:set IB_AUTO_RUN=True&&uv run ebang-securities-mcp-server
Linux&Mac环境运行命令:export IB_AUTO_RUN=True&&uv run ebang-securities-mcp-server

注:第一次启动过程中会下载IB网关程序,需要保证网络通常
注册IB模拟账户地址:https://www.interactivebrokers.com.sg/Universal/Application?ft=T
访问链接:https://localhost:5000进行IB账户认证登录

2. STDIO方式启动
  无需自行启动，通过编程工具使用MCP步骤中，配置使用以下配置即可
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
  
  

3.通过编程工具使用MCP
(1).Cursor
在https://www.cursor.com/cn地址上下载软件，注册登录后创建MCPServer
[图片]
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
配置完毕保存后在MCP工具页面中启用此配置，确保状态为绿色
[图片]
打开聊天框(默认快捷键Ctrl+L)进行对话使用。
[图片]
审核使用工具，就可以看到调用结果了。
[图片]
(1).VS Code
在https://code.visualstudio.com/地址上下载软件
[图片]
在拓展插件中输入Cline进行Install（截图中我已经安装）
安装完毕点击Cline进行模型配置(输入自己的模型API Key 这里我使用的是deepseek)
[图片]
进行MCP服务配置
[图片]
[图片]
填入以下配置内容
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
配置完毕保存后在MCP工具页面中启用此配置，确保状态为绿色
[图片]
在聊天框进行对话使用。
[图片]
审批工具调用，也可以选择Auto-approve，在之后所有调用这个工具的时候都无需审批了
[图片]
[图片]
