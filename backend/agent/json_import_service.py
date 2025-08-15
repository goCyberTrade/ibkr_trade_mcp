from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from uuid import uuid4

from services.supabase import DBConnection
from utils.logger import logger
from templates.template_service import MCPRequirementValue, ConfigType, ProfileId, QualifiedName

@dataclass
class JsonImportAnalysis:
    requires_setup: bool
    missing_regular_credentials: List[Dict[str, Any]] = field(default_factory=list)
    missing_custom_configs: List[Dict[str, Any]] = field(default_factory=list)
    agent_info: Dict[str, Any] = field(default_factory=dict)

@dataclass
class JsonImportRequest:
    json_data: Dict[str, Any]
    account_id: str
    instance_name: Optional[str] = None
    custom_system_prompt: Optional[str] = None
    profile_mappings: Optional[Dict[QualifiedName, ProfileId]] = None
    custom_mcp_configs: Optional[Dict[QualifiedName, ConfigType]] = None

@dataclass
class JsonImportResult:
    status: str
    instance_id: Optional[str] = None
    name: Optional[str] = None
    missing_regular_credentials: List[Dict[str, Any]] = field(default_factory=list)
    missing_custom_configs: List[Dict[str, Any]] = field(default_factory=list)
    agent_info: Dict[str, Any] = field(default_factory=dict)

class JsonImportError(Exception):
    pass

class JsonImportService:
    def __init__(self, db_connection: DBConnection):
        self._db = db_connection
    
    async def analyze_json(self, json_data: Dict[str, Any], account_id: str) -> JsonImportAnalysis:
        logger.info(f"Analyzing imported JSON for user {account_id}")
        
        mcp_requirements = self._extract_mcp_requirements_from_json(json_data)
        
        missing_profiles, missing_configs = await self._validate_requirements(
            mcp_requirements, 
            account_id,
            profile_mappings=None,
            custom_configs=None
        )
        
        agent_info = {
            'name': json_data.get('name', 'Imported Agent'),
            'description': json_data.get('description', ''),
            # Deprecated fields
            'avatar': json_data.get('avatar'),
            'avatar_color': json_data.get('avatar_color'),
            # New field
            'profile_image_url': json_data.get('profile_image_url') or json_data.get('metadata', {}).get('profile_image_url')
        }
        
        return JsonImportAnalysis(
            requires_setup=bool(missing_profiles or missing_configs),
            missing_regular_credentials=missing_profiles,
            missing_custom_configs=missing_configs,
            agent_info=agent_info
        )
    
    async def import_json(self, request: JsonImportRequest) -> JsonImportResult:
        logger.info(f"Importing agent from JSON for user {request.account_id}")
        
        json_data = request.json_data
        
        if not self._validate_json_structure(json_data):
            raise JsonImportError("Invalid JSON structure")
        
        mcp_requirements = self._extract_mcp_requirements_from_json(json_data)
        
        missing_profiles, missing_configs = await self._validate_requirements(
            mcp_requirements,
            request.account_id,
            request.profile_mappings,
            request.custom_mcp_configs
        )
        
        if missing_profiles or missing_configs:
            return JsonImportResult(
                status='configs_required',
                missing_regular_credentials=missing_profiles,
                missing_custom_configs=missing_configs,
                agent_info={
                    'name': json_data.get('name', 'Imported Agent'),
                    'description': json_data.get('description', ''),
                    # Deprecated
                    'avatar': json_data.get('avatar'),
                    'avatar_color': json_data.get('avatar_color'),
                    # New
                    'profile_image_url': json_data.get('profile_image_url') or json_data.get('metadata', {}).get('profile_image_url')
                }
            )
        
        agent_config = await self._build_agent_config_from_json(
            json_data,
            request,
            mcp_requirements
        )
        
        agent_id = await self._create_agent_from_json(
            json_data,
            request,
            agent_config
        )
        
        await self._create_initial_version(
            agent_id,
            request.account_id,
            agent_config,
            request.custom_system_prompt or json_data.get('system_prompt', '')
        )
        
        from utils.cache import Cache
        await Cache.invalidate(f"agent_count_limit:{request.account_id}")
        
        logger.info(f"Successfully imported agent {agent_id} from JSON")
        
        return JsonImportResult(
            status='success',
            instance_id=agent_id,
            name=request.instance_name or json_data.get('name', 'Imported Agent')
        )
    
    def _validate_json_structure(self, json_data: Dict[str, Any]) -> bool:
        required_fields = ['tools', 'system_prompt']
        for field in required_fields:
            if field not in json_data:
                logger.error(f"Missing required field: {field}")
                return False
        
        tools = json_data.get('tools', {})
        if not isinstance(tools, dict):
            logger.error("tools field must be a dictionary")
            return False
        
        return True
    
    def _extract_mcp_requirements_from_json(self, json_data: Dict[str, Any]) -> List[MCPRequirementValue]:
        requirements = []
        
        tools = json_data.get('tools', {})

        mcps = tools.get('mcp', [])
        for mcp in mcps:
            if isinstance(mcp, dict):
                req = MCPRequirementValue(
                    qualified_name=mcp.get('qualifiedName', ''),
                    display_name=mcp.get('name', ''),
                    enabled_tools=mcp.get('enabledTools', []),
                    custom_type=None,
                    toolkit_slug=None,
                    app_slug=None
                )
                requirements.append(req)
        
        custom_mcps = tools.get('custom_mcp', [])
        for mcp in custom_mcps:
            if isinstance(mcp, dict):
                mcp_type = mcp.get('type', 'sse')
                
                if mcp_type == 'composio':
                    req = MCPRequirementValue(
                        qualified_name=mcp.get('mcp_qualified_name', ''),
                        display_name=mcp.get('display_name') or mcp.get('name', ''),
                        enabled_tools=mcp.get('enabledTools', []),
                        custom_type='composio',
                        toolkit_slug=mcp.get('toolkit_slug'),
                        app_slug=mcp.get('toolkit_slug')
                    )
                    requirements.append(req)
                
                else:
                    req = MCPRequirementValue(
                        qualified_name=mcp.get('qualifiedName', ''),
                        display_name=mcp.get('display_name') or mcp.get('name', ''),
                        enabled_tools=mcp.get('enabledTools', []),
                        custom_type=mcp_type,
                        toolkit_slug=None,
                        app_slug=None
                    )
                    requirements.append(req)
        
        return requirements
    
    async def _validate_requirements(
        self,
        requirements: List[MCPRequirementValue],
        account_id: str,
        profile_mappings: Optional[Dict[QualifiedName, ProfileId]],
        custom_configs: Optional[Dict[QualifiedName, ConfigType]]
    ) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        
        missing_profiles = []
        missing_configs = []
        
        from templates.installation_service import InstallationService
        installation_service = InstallationService(self._db)
        
        return await installation_service._validate_installation_requirements(
            requirements,
            profile_mappings,
            custom_configs
        )
    
    async def _build_agent_config_from_json(
        self,
        json_data: Dict[str, Any],
        request: JsonImportRequest,
        requirements: List[MCPRequirementValue]
    ) -> Dict[str, Any]:
        
        tools = json_data.get('tools', {})
        
        agentpress_tools = {}
        json_agentpress = tools.get('agentpress', {})
        for tool_name, tool_config in json_agentpress.items():
            if isinstance(tool_config, dict):
                agentpress_tools[tool_name] = tool_config.get('enabled', True)
            else:
                agentpress_tools[tool_name] = bool(tool_config)
        
        agent_config = {
            'tools': {
                'agentpress': agentpress_tools,
                'mcp': [],
                'custom_mcp': []
            },
            'metadata': json_data.get('metadata', {}),
            'system_prompt': request.custom_system_prompt or json_data.get('system_prompt', '')
        }
        
        from credentials import get_profile_service
        profile_service = get_profile_service(self._db)
        
        for req in requirements:
            if req.custom_type == 'composio':
                profile_id = request.profile_mappings.get(req.qualified_name) if request.profile_mappings else None
                if profile_id:
                    from composio_integration.composio_profile_service import ComposioProfileService
                    composio_service = ComposioProfileService(self._db)
                    mcp_config = await composio_service.get_mcp_config_for_agent(profile_id)
                    if mcp_config:
                        mcp_config['enabledTools'] = req.enabled_tools
                        agent_config['tools']['custom_mcp'].append(mcp_config)
            
            elif not req.custom_type:
                profile_id = request.profile_mappings.get(req.qualified_name) if request.profile_mappings else None
                if profile_id:
                    profile = await profile_service.get_profile_by_id(profile_id)
                    if profile:
                        mcp_config = {
                            'name': req.display_name,
                            'qualifiedName': req.qualified_name,
                            'config': profile.config,
                            'enabledTools': req.enabled_tools,
                            'selectedProfileId': profile_id
                        }
                        agent_config['tools']['mcp'].append(mcp_config)
            
            else:
                custom_config = request.custom_mcp_configs.get(req.qualified_name) if request.custom_mcp_configs else None
                if custom_config:
                    mcp_config = {
                        'name': req.display_name,
                        'type': req.custom_type,
                        'customType': req.custom_type,
                        'qualifiedName': req.qualified_name,
                        'config': custom_config,
                        'enabledTools': req.enabled_tools
                    }
                    agent_config['tools']['custom_mcp'].append(mcp_config)
        
        return agent_config
    
    async def _create_agent_from_json(
        self,
        json_data: Dict[str, Any],
        request: JsonImportRequest,
        agent_config: Dict[str, Any]
    ) -> str:
        
        client = await self._db.client
        
        agent_name = request.instance_name or json_data.get('name', 'Imported Agent')
        
        insert_data = {
            "account_id": request.account_id,
            "name": agent_name,
            "description": json_data.get('description', ''),
            "avatar": json_data.get('avatar'),
            "avatar_color": json_data.get('avatar_color'),
            "is_default": False,
            "tags": json_data.get('tags', []),
            "version_count": 1,
            "metadata": {
                "imported_from_json": True,
                "import_date": datetime.now(timezone.utc).isoformat()
            }
        }
        
        result = await client.table('agents').insert(insert_data).execute()
        
        if not result.data:
            raise JsonImportError("Failed to create agent from JSON")
        
        return result.data[0]['agent_id']
    
    async def _create_initial_version(
        self,
        agent_id: str,
        account_id: str,
        agent_config: Dict[str, Any],
        system_prompt: str
    ) -> None:
        
        from agent.versioning.version_service import VersionService
        version_service = VersionService()
        
        await version_service.create_version(
            agent_id=agent_id,
            user_id=account_id,
            system_prompt=system_prompt,
            agentpress_tools=agent_config['tools']['agentpress'],
            configured_mcps=agent_config['tools']['mcp'],
            custom_mcps=agent_config['tools']['custom_mcp'],
            change_description="Initial version from JSON import"
        ) 