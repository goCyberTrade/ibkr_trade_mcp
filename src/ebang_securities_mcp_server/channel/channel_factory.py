from enum import Enum

from ebang_securities_mcp_server.channel.ibkr_service import IBKrService


class Channel(Enum):
    IBKR = "ibkr"


class ChannelFactory:
    channel_mapping = {
        Channel.IBKR: IBKrService,
    }


    @classmethod
    def create(cls, channel: str):
        return cls.channel_mapping[Channel(channel)]()