from ebang_securities_mcp_server.channel.channel_factory import Channel

tools = []

@tools.append
def list_channel():
    """
    List supported channels.
    Returns:
        Return the supported channel identifier information. The mapping between channel identifiers and their corresponding channel names is as follows:
            ibkr: Interactive Brokers
    """
    channel_data = []
    for channel_enum in Channel:
        # 通过 ChannelFactory 创建 Channel 实例
        channel_data.append(channel_enum.value)
    return channel_data
