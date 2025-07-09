import logging
import sys
from pathlib import Path
import click
from mcp.server.fastmcp import FastMCP
from loguru import logger
from ebang_securities_mcp_server.channel.channel_factory import Channel, ChannelFactory
from ebang_securities_mcp_server.tools import position_tools, channel_tools, trade_tools
from ebang_securities_mcp_server.tools import account_tools
from ebang_securities_mcp_server.channel import ibkr_gateway_manager


logger.remove()
logger.add(sink=sys.stdout, level="DEBUG")



@click.command()
@click.option(
    "--transport",
    type=click.Choice(["stdio", "sse"]),
    default="sse",
    help="Transport type",
)
@click.option(
    "--port",
    type=int,
    default=8000,
    help="Port number",
)
def main(transport: str, port: int):

    if transport == 'sse':
        logger.add(Path('log.log'))

    #ib gateway
    ibkr_gateway_manager.check_and_run_gateway()
    # Create an MCP server
    mcp = FastMCP(
        name="ebang-securities-mcp-server",
        port=port,
        host="0.0.0.0",
    )
    # Initialize and run the server
    logger.info(f'mcp server is running on {transport} mode.')
    for tool in trade_tools.tools:
        mcp.add_tool(tool)

    for tool in position_tools.tools:
        mcp.add_tool(tool)

    for tool in channel_tools.tools:
        mcp.add_tool(tool)

    for tool in account_tools.tools:
        mcp.add_tool(tool)

    # run task
    for channel in Channel:
        ChannelFactory.create(channel.value).task_handle()

    # run mcp service
    mcp.run(transport=transport)




if __name__ == "__main__":
    main()
