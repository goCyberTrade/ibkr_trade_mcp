from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from datetime import datetime, timezone
from utils.logger import logger

from .config_manager import SunaConfigManager, SunaConfiguration
from .repository import SunaAgentRepository, SunaAgentRecord


@dataclass
class SyncResult:
    success: bool
    synced_count: int = 0
    failed_count: int = 0
    errors: List[str] = None
    details: List[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.errors is None:
            self.errors = []
        if self.details is None:
            self.details = []


class SunaSyncService:
    def __init__(self):
        self.config_manager = SunaConfigManager()
        self.repository = SunaAgentRepository()
    
    async def sync_all_agents(self, dry_run: bool = False) -> SyncResult:
        logger.info("🚀 Starting Suna agent metadata sync")
        
        try:
            current_config = self.config_manager.get_current_config()
            agents_needing_sync = await self.repository.find_suna_agents_needing_sync(
                current_config.version_tag
            )
            
            if not agents_needing_sync:
                logger.info("📋 All Suna agents already have current metadata")
                return SyncResult(
                    success=True,
                    synced_count=0,
                    details=[{"message": "All agents already up to date"}]
                )
            
            logger.info(f"📊 Updating metadata for {len(agents_needing_sync)} agents to version {current_config.version_tag}")
            
            if dry_run:
                return SyncResult(
                    success=True,
                    details=[{
                        "message": f"DRY RUN: Would update metadata for {len(agents_needing_sync)} agents",
                        "agents": [{"agent_id": a.agent_id, "account_id": a.account_id} for a in agents_needing_sync]
                    }]
                )
            
            success_count = 0
            failed_count = 0
            errors = []
            
            for agent in agents_needing_sync:
                try:
                    await self.repository.update_agent_metadata(
                        agent.agent_id,
                        current_config.version_tag
                    )
                    success_count += 1
                    logger.info(f"✅ Updated metadata for agent {agent.agent_id}")
                except Exception as e:
                    failed_count += 1
                    error_msg = f"Failed to update agent {agent.agent_id}: {str(e)}"
                    errors.append(error_msg)
                    logger.error(error_msg)
            
            return SyncResult(
                success=failed_count == 0,
                synced_count=success_count,
                failed_count=failed_count,
                errors=errors,
                details=[{
                    "message": f"Updated metadata for {success_count} agents, {failed_count} failed"
                }]
            )
            
        except Exception as e:
            error_msg = f"Sync operation failed: {str(e)}"
            logger.error(error_msg)
            return SyncResult(success=False, errors=[error_msg])
    
    async def install_for_all_missing_users(self) -> SyncResult:
        logger.info("🚀 Installing Suna agents for users who don't have them")
        
        try:
            current_config = self.config_manager.get_current_config()
            all_accounts = await self.repository.get_all_personal_accounts()
            existing_agents = await self.repository.find_all_suna_agents()
            existing_account_ids = {agent.account_id for agent in existing_agents}
            
            missing_accounts = [acc for acc in all_accounts if acc not in existing_account_ids]
            
            if not missing_accounts:
                return SyncResult(
                    success=True,
                    details=[{"message": "All users already have Suna agents"}]
                )
            
            logger.info(f"📦 Installing Suna for {len(missing_accounts)} users")
            
            success_count = 0
            failed_count = 0
            errors = []
            
            for account_id in missing_accounts:
                try:
                    await self.repository.create_suna_agent_simple(
                        account_id,
                        current_config.version_tag
                    )
                    success_count += 1
                    logger.info(f"✅ Installed Suna for user {account_id}")
                except Exception as e:
                    failed_count += 1
                    error_msg = f"Failed to install for user {account_id}: {str(e)}"
                    errors.append(error_msg)
                    logger.error(error_msg)
            
            return SyncResult(
                success=failed_count == 0,
                synced_count=success_count,
                failed_count=failed_count,
                errors=errors,
                details=[{
                    "message": f"Installed for {success_count} users, {failed_count} failed"
                }]
            )
            
        except Exception as e:
            error_msg = f"Installation operation failed: {str(e)}"
            logger.error(error_msg)
            return SyncResult(success=False, errors=[error_msg])
    
    async def get_sync_status(self) -> Dict[str, Any]:
        try:
            current_config = self.config_manager.get_current_config()
            agents_needing_sync = await self.repository.find_suna_agents_needing_sync(
                current_config.version_tag
            )
            stats = await self.repository.get_agent_stats()
            
            return {
                "current_config_version": current_config.version_tag,
                "total_agents": stats.get("total_agents", 0),
                "agents_needing_sync": len(agents_needing_sync),
                "version_distribution": stats.get("version_distribution", {}),
                "last_sync": stats.get("last_updated", "unknown"),
                "note": "System prompt & tools always current from SunaConfig"
            }
            
        except Exception as e:
            logger.error(f"Failed to get sync status: {e}")
            return {"error": str(e)} 