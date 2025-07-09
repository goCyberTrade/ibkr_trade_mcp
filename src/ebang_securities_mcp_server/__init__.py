import asyncio
import sys
from pathlib import Path

from loguru import logger

from . import server


logger.remove()
logger.add(sink=sys.stdout, level="DEBUG")
logger.add(Path('log.log'), level="DEBUG")


def main():
    """Main entry point for the package."""
    asyncio.run(server.main())


__all__ = ['main', 'server']
