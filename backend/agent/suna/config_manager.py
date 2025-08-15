import datetime
from typing import Dict, Any
from dataclasses import dataclass
from agent.suna.config import SunaConfig


@dataclass
class SunaConfiguration:
    name: str
    description: str
    configured_mcps: list
    custom_mcps: list
    restrictions: Dict[str, Any]
    version_tag: str


class SunaConfigManager:
    def get_current_config(self) -> SunaConfiguration:
        version_tag = self._generate_version_tag()
        
        return SunaConfiguration(
            name=SunaConfig.NAME,
            description=SunaConfig.DESCRIPTION,
            configured_mcps=SunaConfig.DEFAULT_MCPS.copy(),
            custom_mcps=SunaConfig.DEFAULT_CUSTOM_MCPS.copy(),
            restrictions=SunaConfig.USER_RESTRICTIONS.copy(),
            version_tag=version_tag
        )
    
    def has_config_changed(self, last_version_tag: str) -> bool:
        current = self.get_current_config()
        return current.version_tag != last_version_tag
    
    def validate_config(self, config: SunaConfiguration) -> tuple[bool, list[str]]:
        errors = []
        
        if not config.name.strip():
            errors.append("Name cannot be empty")
            
        return len(errors) == 0, errors
    
    def _generate_version_tag(self) -> str:
        import hashlib
        import json
        
        config_data = {
            "name": SunaConfig.NAME,
            "description": SunaConfig.DESCRIPTION,
            "system_prompt": SunaConfig.get_system_prompt(),
            "default_tools": SunaConfig.DEFAULT_TOOLS,
            "avatar": SunaConfig.AVATAR,
            "avatar_color": SunaConfig.AVATAR_COLOR,
            "restrictions": SunaConfig.USER_RESTRICTIONS,
        }
        
        config_str = json.dumps(config_data, sort_keys=True)
        hash_obj = hashlib.md5(config_str.encode())
        return f"config-{hash_obj.hexdigest()[:8]}" 