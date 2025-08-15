#!/usr/bin/env python3
"""
SUNA AGENT INSTALLER

Usage:
    python suna_manager.py install                    # Install with default batch size (50)
    python suna_manager.py install --batch-size 100   # Install with custom batch size
    python suna_manager.py cleanup                    # Fix broken agents (agents without versions)
    python suna_manager.py repair                     # Repair orphaned agents (agents with missing version records)
    
Recovery:
    If interrupted, simply re-run the same command - it will skip completed users
    and retry any failed or incomplete installations.
    
    If you see discrepancies between agents and agent_versions tables, run:
    python suna_manager.py cleanup
"""

import asyncio
import argparse
import sys
import json
import time
import signal
from pathlib import Path

backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

from agent.suna import SunaSyncService
from utils.logger import logger

# Global flag for graceful shutdown
shutdown_requested = False

def signal_handler(signum, frame):
    global shutdown_requested
    print_warning(f"\n🛑 Shutdown signal received ({signal.Signals(signum).name})")
    print_info("Finishing current batch before shutdown...")
    print_info("Re-run the same command to resume where you left off")
    shutdown_requested = True

def print_success(message: str):
    print(f"✅ {message}")

def print_error(message: str):
    print(f"❌ {message}")

def print_info(message: str):
    print(f"ℹ️  {message}")

def print_warning(message: str):
    print(f"⚠️  {message}")


class SunaManagerCLI:
    def __init__(self):
        self.sync_service = SunaSyncService()
    
    async def cleanup_command(self):
        """Clean up broken agents (agents without versions) caused by termination"""
        print("🧹 Cleaning up broken Suna agents (agents without versions)")
        
        try:
            # Find broken agents
            broken_agents = await self._find_broken_agents()
            
            if not broken_agents:
                print_success("No broken agents found! All agents have proper versions.")
                return
            
            print_warning(f"Found {len(broken_agents)} broken agents (agents without versions)")
            for agent in broken_agents[:5]:  # Show first 5
                print_info(f"  - Agent {agent['agent_id']} for user {agent['account_id']}")
            
            if len(broken_agents) > 5:
                print_info(f"  ... and {len(broken_agents) - 5} more")
            
            # Confirm cleanup
            print_info("These broken agents will be deleted and recreated properly")
            
            # Clean up broken agents
            cleaned_count = 0
            failed_count = 0
            
            for agent in broken_agents:
                try:
                    await self.sync_service.repository.delete_agent(agent['agent_id'])
                    cleaned_count += 1
                    logger.info(f"Cleaned up broken agent {agent['agent_id']} for user {agent['account_id']}")
                except Exception as e:
                    failed_count += 1
                    logger.error(f"Failed to clean up agent {agent['agent_id']}: {e}")
            
            print_success(f"Cleaned up {cleaned_count} broken agents")
            if failed_count > 0:
                print_warning(f"Failed to clean up {failed_count} agents")
            
            print_info("💡 Now run: python suna_manager.py install")
            print_info("   The install will recreate these users' agents properly")
            
        except Exception as e:
            print_error(f"Cleanup failed: {e}")
            logger.error(f"Cleanup error: {e}")
    
    async def _find_broken_agents(self):
        """Find Suna agents that don't have corresponding versions"""
        try:
            client = await self.sync_service.repository.db.client
            
            # Manual query to find broken agents
            agents_result = await client.table('agents').select(
                'agent_id, account_id, current_version_id'
            ).eq('metadata->>is_suna_default', 'true').execute()
            
            broken_agents = []
            for agent in agents_result.data:
                if not agent.get('current_version_id'):
                    # Agent has no current_version_id - definitely broken
                    broken_agents.append(agent)
                else:
                    # Check if the version actually exists
                    version_result = await client.table('agent_versions').select(
                        'version_id'
                    ).eq('version_id', agent['current_version_id']).execute()
                    
                    if not version_result.data:
                        # Agent points to non-existent version - broken
                        broken_agents.append(agent)
            
            return broken_agents
            
        except Exception as e:
            logger.error(f"Failed to find broken agents: {e}")
            raise
    
    async def status_command(self):
        """Show status of Suna agent installation"""
        print("📊 Suna Agent Installation Status")
        
        try:
            client = await self.sync_service.repository.db.client
            
            # Count total personal accounts
            accounts_result = await client.schema('basejump').table('accounts').select(
                'id', count='exact'
            ).eq('personal_account', True).execute()
            total_accounts = accounts_result.count or 0
            
            # Count Suna agents
            agents_result = await client.table('agents').select(
                'agent_id', count='exact'
            ).eq('metadata->>is_suna_default', 'true').execute()
            total_agents = agents_result.count or 0
            
            # Count all agent versions (simpler approach)
            all_versions_result = await client.table('agent_versions').select(
                'version_id', count='exact'
            ).execute()
            
            suna_agents_result = await client.table('agents').select(
                'agent_id'
            ).eq('metadata->>is_suna_default', 'true').execute()
            
            suna_agent_ids = [a['agent_id'] for a in (suna_agents_result.data or [])]
            
            if suna_agent_ids:
                suna_versions_result = await client.table('agent_versions').select(
                    'version_id', count='exact'
                ).in_('agent_id', suna_agent_ids).execute()
                total_suna_versions = suna_versions_result.count or 0
            else:
                total_suna_versions = 0
            
            # Find broken agents
            broken_agents = await self._find_broken_agents()
            broken_count = len(broken_agents)
            
            print_info(f"Total personal accounts: {total_accounts}")
            print_info(f"Suna agents created: {total_agents}")
            print_info(f"Agent versions created: {total_suna_versions}")
            
            if broken_count > 0:
                print_warning(f"Broken agents (no version): {broken_count}")
                print_info("💡 Run: python suna_manager.py cleanup")
            else:
                print_success("All agents have proper versions!")
            
            remaining = total_accounts - (total_agents - broken_count)
            if remaining > 0:
                print_info(f"Users needing Suna: {remaining}")
                print_info("💡 Run: python suna_manager.py install")
            else:
                print_success("All users have Suna agents!")
            
        except Exception as e:
            print_error(f"Status check failed: {e}")
            logger.error(f"Status error: {e}")
    
    async def install_command(self, batch_size: int = 100):
        global shutdown_requested
        
        print(f"🚀 Installing Suna for users who don't have it (batch size: {batch_size})")
        print_info(f"Concurrent processing will dramatically improve performance for large user bases")
        print_info("💡 Safe to interrupt: completed users won't be re-processed on restart")
        
        start_time = time.time()
        
        try:
            all_accounts = await self.sync_service.repository.get_all_personal_accounts()
            existing_agents = await self.sync_service.repository.find_all_suna_agents()
            existing_account_ids = {agent.account_id for agent in existing_agents}
            missing_accounts = [acc for acc in all_accounts if acc not in existing_account_ids]
            
            if not missing_accounts:
                print_success("All users already have Suna agents!")
                return
                
            total_needed = len(missing_accounts)
            print_info(f"Found {total_needed} users needing Suna agents")
            
        except Exception as e:
            print_error(f"Failed to get user counts: {e}")
            return
        
        processed = 0
        try:
            result = await self._install_with_progress(batch_size, total_needed)
        except KeyboardInterrupt:
            print_warning("Installation interrupted by user")
            return
        except Exception as e:
            print_error(f"Installation failed: {e}")
            return
            
        end_time = time.time()
        duration = end_time - start_time
        
        if result.success:
            print_success(f"Successfully installed Suna for {result.synced_count} users")
            if 'total_batches' in result.details[0]:
                batches = result.details[0]['total_batches']
                print_info(f"Processed in {batches} concurrent batches")
            
            if result.synced_count > 0:
                avg_time = duration / result.synced_count
                print_info(f"Performance: {duration:.1f}s total, {avg_time:.2f}s per user")
                
                estimated_sequential = result.synced_count * 0.5
                time_saved = estimated_sequential - duration
                if time_saved > 60:
                    print_info(f"⚡ Concurrent processing saved ~{time_saved/60:.1f} minutes vs sequential")
        else:
            print_error("Installation completed with errors!")
            
        if result.failed_count > 0:
            print_warning(f"Failed to install for {result.failed_count} users")
            if result.failed_count <= 5:
                for error in result.errors:
                    print(f"  💥 {error}")
            print_info("💡 Re-run the same command to retry failed installations")
    
    async def _install_with_progress(self, batch_size: int, total_needed: int):
        global shutdown_requested
        try:
            current_config = self.sync_service.config_manager.get_current_config()
            all_accounts = await self.sync_service.repository.get_all_personal_accounts()
            existing_agents = await self.sync_service.repository.find_all_suna_agents()
            existing_account_ids = {agent.account_id for agent in existing_agents}
            
            missing_accounts = [acc for acc in all_accounts if acc not in existing_account_ids]
            
            if not missing_accounts:
                from agent.suna.sync_service import SyncResult
                return SyncResult(
                    success=True,
                    details=[{"message": "All users already have Suna agents"}]
                )
            
            logger.info(f"📦 Installing Suna for {len(missing_accounts)} users in batches of {batch_size}")
            
            total_success = 0
            total_failed = 0
            all_errors = []
            
            for i in range(0, len(missing_accounts), batch_size):
                if shutdown_requested:
                    print_warning("🛑 Graceful shutdown requested - stopping after current batch")
                    break
                    
                batch = missing_accounts[i:i + batch_size]
                batch_num = (i // batch_size) + 1
                total_batches = (len(missing_accounts) + batch_size - 1) // batch_size
                
                print_info(f"🔄 Processing batch {batch_num}/{total_batches} ({len(batch)} users)")
                
                try:
                    success_count, failed_count, errors = await self.sync_service._process_batch(batch)
                    
                    total_success += success_count
                    total_failed += failed_count
                    all_errors.extend(errors)
                    
                    progress_pct = ((total_success + total_failed) / len(missing_accounts)) * 100
                    print_info(f"✅ Batch {batch_num}/{total_batches} completed: {success_count} success, {failed_count} failed ({progress_pct:.1f}% total progress)")
                    
                except Exception as e:
                    batch_error = f"Batch {batch_num} failed: {str(e)}"
                    logger.error(batch_error)
                    all_errors.append(batch_error)
                    total_failed += len(batch)
                
                if i + batch_size < len(missing_accounts) and not shutdown_requested:
                    await asyncio.sleep(0.1)
            
            final_message = f"Installed for {total_success} users, {total_failed} failed"
            if shutdown_requested:
                final_message += " (interrupted - safe to resume)"
            
            logger.info(f"🎉 Installation completed: {final_message}")
            
            from agent.suna.sync_service import SyncResult
            return SyncResult(
                success=total_failed == 0 and not shutdown_requested,
                synced_count=total_success,
                failed_count=total_failed,
                errors=all_errors,
                details=[{
                    "message": final_message,
                    "batch_size": batch_size,
                    "total_batches": (len(missing_accounts) + batch_size - 1) // batch_size,
                    "interrupted": shutdown_requested
                }]
            )
            
        except Exception as e:
            error_msg = f"Installation operation failed: {str(e)}"
            logger.error(error_msg)
            from agent.suna.sync_service import SyncResult
            return SyncResult(success=False, errors=[error_msg])

    async def repair_command(self):
        """Repair orphaned Suna agents by creating missing versions and fixing broken pointers"""
        print("🛠️  Repairing orphaned Suna agents and fixing broken version pointers")
        try:
            from datetime import datetime, timezone
            from agent.suna.config import SunaConfig
            from agent.versioning.version_service import get_version_service

            repo = self.sync_service.repository
            config_manager = self.sync_service.config_manager

            current_config = config_manager.get_current_config()
            version_tag = current_config.version_tag

            # Unified config in the structure expected by repository repair helpers
            unified_config = {
                "system_prompt": SunaConfig.get_system_prompt(),
                "model": SunaConfig.DEFAULT_MODEL,
                "tools": {
                    "agentpress": SunaConfig.DEFAULT_TOOLS
                }
            }

            # Build config_data metadata used by repository repair
            config_data = {
                "metadata": {
                    "is_suna_default": True,
                    "centrally_managed": True,
                    "config_version": version_tag,
                    "last_central_update": datetime.now(timezone.utc).isoformat()
                }
            }

            # Step 1: Repair agents with no versions at all
            orphaned = await repo.find_orphaned_suna_agents()
            if not orphaned:
                print_success("No orphaned Suna agents found (all have version records)")
            else:
                print_warning(f"Found {len(orphaned)} orphaned agents without versions")
                repaired = 0
                failed = 0
                for agent in orphaned:
                    try:
                        await repo.create_version_record_for_existing_agent(
                            agent_id=agent.agent_id,
                            account_id=agent.account_id,
                            config_data=config_data,
                            unified_config=unified_config,
                            version_tag=version_tag
                        )
                        repaired += 1
                    except Exception as e:
                        failed += 1
                        logger.error(f"Failed to repair orphaned agent {agent.agent_id}: {e}")
                print_success(f"Created missing versions for {repaired} agents")
                if failed:
                    print_warning(f"Failed to repair {failed} agents")

            # Step 2: Fix agents whose current_version_id is missing/invalid but versions exist
            broken = await self._find_broken_agents()
            if not broken:
                print_success("No agents with broken version pointers found")
            else:
                # Filter to those that actually have versions now
                client = await repo.db.client
                fixed = 0
                skipped = 0
                failed = 0
                version_service = await get_version_service()

                for agent in broken:
                    try:
                        versions_result = await client.table('agent_versions').select('version_id, is_active, created_at').eq('agent_id', agent['agent_id']).order('created_at', desc=True).execute()
                        versions = versions_result.data or []
                        if not versions:
                            skipped += 1
                            continue

                        # Prefer active version, fallback to most recent
                        active = next((v for v in versions if v.get('is_active')), None)
                        target_id = active['version_id'] if active else versions[0]['version_id']

                        updated = await repo.update_agent_version_pointer(agent['agent_id'], target_id)
                        if updated:
                            fixed += 1
                        else:
                            failed += 1
                    except Exception as e:
                        failed += 1
                        logger.error(f"Failed to fix pointer for agent {agent['agent_id']}: {e}")

                print_success(f"Fixed version pointers for {fixed} agents")
                if skipped:
                    print_info(f"Skipped {skipped} agents that still have no versions (already handled above)")
                if failed:
                    print_warning(f"Failed to fix {failed} agents")

            print_success("Repair completed")
        except Exception as e:
            print_error(f"Repair failed: {e}")
            logger.error(f"Repair error: {e}")


async def main():
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    parser = argparse.ArgumentParser(
        description="🌞 Suna Agent Manager - Concurrent Installation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Install command
    install_parser = subparsers.add_parser('install', help='📦 Install Suna for users who don\'t have it')
    install_parser.add_argument(
        '--batch-size', 
        type=int, 
        default=100, 
        help='Number of users to process concurrently in each batch (default: 100)'
    )
    
    # Cleanup command
    subparsers.add_parser('cleanup', help='🧹 Clean up broken agents (agents without versions)')
    
    # Status command
    subparsers.add_parser('status', help='📊 Show installation status and statistics')

    # Repair command
    subparsers.add_parser('repair', help='🛠️  Repair orphaned Suna agents and fix broken version pointers')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    cli = SunaManagerCLI()
    
    try:
        if args.command == 'install':
            await cli.install_command(batch_size=args.batch_size)
        elif args.command == 'cleanup':
            await cli.cleanup_command()
        elif args.command == 'status':
            await cli.status_command()
        elif args.command == 'repair':
            await cli.repair_command()
        else:
            parser.print_help()
            
    except KeyboardInterrupt:
        print_warning("Operation cancelled by user")
        print_info("💡 Safe to re-run - completed users won't be re-processed")
    except Exception as e:
        print_error(f"Unexpected error: {str(e)}")
        logger.error(f"CLI error: {str(e)}")


if __name__ == "__main__":
    asyncio.run(main()) 