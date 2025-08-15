#!/usr/bin/env python3
"""
Suna Default Agent Management Script

This script provides administrative functions for managing Suna default agents across all users.

Usage:
    # 🚀 EASY COMMANDS (Most common)
    python manage_suna_agents.py sync                  # Push config changes to all users (recommended)
    python manage_suna_agents.py install-all          # Install Suna for all users who don't have it
    python manage_suna_agents.py stats                # Show Suna agent statistics
    
    # 🔧 ADVANCED COMMANDS
    python manage_suna_agents.py update-all           # Update all Suna agents to latest version
    python manage_suna_agents.py install-user <id>    # Install Suna for specific user
    python manage_suna_agents.py update-user <id>     # Update Suna agent for specific user
    python manage_suna_agents.py version <version>    # Update all agents to specific version

Examples:
    python manage_suna_agents.py sync                 # Most common - sync config changes
    python manage_suna_agents.py install-all
    python manage_suna_agents.py stats
    python manage_suna_agents.py install-user 123e4567-e89b-12d3-a456-426614174000
"""

import asyncio
import argparse
import sys
import json
from pathlib import Path

# Add the backend directory to the path so we can import modules
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from utils.suna_default_agent_service import SunaDefaultAgentService
from services.supabase import DBConnection
from utils.logger import logger


class SunaAgentManager:
    def __init__(self):
        self.service = SunaDefaultAgentService()
    
    async def sync_config(self):
        """🚀 EASY SYNC: Push current suna_config.py changes to all users"""
        print("🔄 Syncing Suna configuration from suna_config.py to all users...")
        print("📝 This will update system prompt, tools, and settings for all Suna agents")
        
        result = await self.service.sync_all_suna_agents()
        
        print(f"✅ Configuration sync completed!")
        print(f"   🔄 Synced: {result['updated_count']}")
        print(f"   ❌ Failed: {result['failed_count']}")
        
        if result['failed_count'] > 0:
            print("\n❌ Failed syncs:")
            for detail in result['details']:
                if detail['status'] == 'failed':
                    print(f"   - Agent {detail['agent_id']} (User {detail['account_id']}): {detail.get('error', 'Unknown error')}")
        
        if result['updated_count'] > 0:
            print(f"\n🎉 Successfully synced configuration to {result['updated_count']} users!")
            print("💡 All users now have the latest Suna configuration from suna_config.py")
    
    async def install_all_users(self):
        """Install Suna agent for all users who don't have it"""
        print("🚀 Installing Suna default agent for all users who don't have it...")
        
        result = await self.service.install_for_all_users()
        
        print(f"✅ Installation completed!")
        print(f"   📦 Installed: {result['installed_count']}")
        print(f"   ❌ Failed: {result['failed_count']}")
        
        if result['failed_count'] > 0:
            print("\n❌ Failed installations:")
            for detail in result['details']:
                if detail['status'] == 'failed':
                    print(f"   - User {detail['account_id']}: {detail.get('error', 'Unknown error')}")
        
        if result['installed_count'] > 0:
            print(f"\n✅ Successfully installed Suna for {result['installed_count']} users")
            
    async def update_all_agents(self, target_version=None):
        """Update all Suna agents to latest or specific version"""
        version_text = target_version or "latest"
        print(f"🔄 Updating all Suna default agents to {version_text} version...")
        
        result = await self.service.update_all_suna_agents(target_version)
        
        print(f"✅ Update completed!")
        print(f"   🔄 Updated: {result['updated_count']}")
        print(f"   ❌ Failed: {result['failed_count']}")
        
        if result['failed_count'] > 0:
            print("\n❌ Failed updates:")
            for detail in result['details']:
                if detail['status'] == 'failed':
                    print(f"   - Agent {detail['agent_id']} (User {detail['account_id']}): {detail.get('error', 'Unknown error')}")
        
        if result['updated_count'] > 0:
            print(f"\n✅ Successfully updated {result['updated_count']} Suna agents")
    
    async def install_user(self, account_id):
        """Install Suna agent for specific user"""
        print(f"🚀 Installing Suna default agent for user {account_id}...")
        
        agent_id = await self.service.install_suna_agent_for_user(account_id)
        
        if agent_id:
            print(f"✅ Successfully installed Suna agent {agent_id} for user {account_id}")
        else:
            print(f"❌ Failed to install Suna agent for user {account_id}")
    
    async def update_user(self, account_id):
        """Update Suna agent for specific user"""
        print(f"🔄 Updating Suna default agent for user {account_id}...")
        
        # Install/replace the agent with latest config
        agent_id = await self.service.install_suna_agent_for_user(account_id, replace_existing=True)
        
        if agent_id:
            print(f"✅ Successfully updated Suna agent {agent_id} for user {account_id}")
        else:
            print(f"❌ Failed to update Suna agent for user {account_id}")
    
    async def show_stats(self):
        """Show Suna agent statistics"""
        print("📊 Suna Default Agent Statistics")
        print("=" * 50)
        
        stats = await self.service.get_suna_agent_stats()
        
        if 'error' in stats:
            print(f"❌ Error getting stats: {stats['error']}")
            return
        
        print(f"Total Agents: {stats.get('total_agents', 0)}")
        print(f"Active Agents: {stats.get('active_agents', 0)}")
        print(f"Inactive Agents: {stats.get('inactive_agents', 0)}")
        
        version_dist = stats.get('version_distribution', {})
        if version_dist:
            print(f"\nVersion Distribution:")
            for version, count in version_dist.items():
                print(f"  {version}: {count} agents")
        
        creation_dates = stats.get('creation_dates', {})
        if creation_dates:
            print(f"\nCreation Dates (Last 12 months):")
            for month, count in sorted(creation_dates.items(), reverse=True):
                print(f"  {month}: {count} agents")


async def main():
    parser = argparse.ArgumentParser(
        description="Manage Suna default agents across all users",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # 🚀 EASY COMMANDS
    subparsers.add_parser('sync', help='🚀 Sync suna_config.py changes to all users (RECOMMENDED)')
    subparsers.add_parser('install-all', help='Install Suna agent for all users who don\'t have it')
    subparsers.add_parser('stats', help='Show Suna agent statistics')
    
    # 🔧 ADVANCED COMMANDS  
    subparsers.add_parser('update-all', help='Update all Suna agents to latest version')
    
    # Install user command
    install_user_parser = subparsers.add_parser('install-user', help='Install Suna agent for specific user')
    install_user_parser.add_argument('account_id', help='Account ID to install Suna for')
    
    # Update user command
    update_user_parser = subparsers.add_parser('update-user', help='Update Suna agent for specific user')
    update_user_parser.add_argument('account_id', help='Account ID to update Suna for')
    
    # Version command
    version_parser = subparsers.add_parser('version', help='Update all agents to specific version')
    version_parser.add_argument('target_version', help='Version to update to (e.g., 1.1.0)')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    manager = SunaAgentManager()
    
    try:
        if args.command == 'sync':
            await manager.sync_config()
        elif args.command == 'install-all':
            await manager.install_all_users()
        elif args.command == 'stats':
            await manager.show_stats()
        elif args.command == 'update-all':
            await manager.update_all_agents()
        elif args.command == 'install-user':
            await manager.install_user(args.account_id)
        elif args.command == 'update-user':
            await manager.update_user(args.account_id)
        elif args.command == 'version':
            await manager.update_all_agents(args.target_version)
        else:
            parser.print_help()
            
    except KeyboardInterrupt:
        print("\n⚠️  Operation cancelled by user")
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        logger.error(f"Script error: {str(e)}")


if __name__ == "__main__":
    asyncio.run(main()) 