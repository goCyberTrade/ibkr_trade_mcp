from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from uuid import uuid4

from services.supabase import DBConnection
from utils.logger import logger
from .template_service import AgentTemplate, MCPRequirementValue, ConfigType, ProfileId, QualifiedName

@dataclass(frozen=True)
class AgentInstance:
    instance_id: str
    account_id: str
    name: str
    template_id: Optional[str] = None
    description: Optional[str] = None
    credential_mappings: Dict[QualifiedName, ProfileId] = field(default_factory=dict)
    custom_system_prompt: Optional[str] = None
    is_active: bool = True
    is_default: bool = False
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    avatar: Optional[str] = None
    avatar_color: Optional[str] = None

@dataclass
class TemplateInstallationRequest:
    template_id: str
    account_id: str
    instance_name: Optional[str] = None
    custom_system_prompt: Optional[str] = None
    profile_mappings: Optional[Dict[QualifiedName, ProfileId]] = None
    custom_mcp_configs: Optional[Dict[QualifiedName, ConfigType]] = None

@dataclass
class TemplateInstallationResult:
    status: str
    instance_id: Optional[str] = None
    name: Optional[str] = None
    missing_regular_credentials: List[Dict[str, Any]] = field(default_factory=list)
    missing_custom_configs: List[Dict[str, Any]] = field(default_factory=list)
    template_info: Optional[Dict[str, Any]] = None

class TemplateInstallationError(Exception):
    pass

class InvalidCredentialError(Exception):
    pass

class InstallationService:
    def __init__(self, db_connection: DBConnection):
        self._db = db_connection
    
    async def install_template(self, request: TemplateInstallationRequest) -> TemplateInstallationResult:
        logger.info(f"Installing template {request.template_id} for user {request.account_id}")
        
        template = await self._get_template(request.template_id)
        if not template:
            raise TemplateInstallationError("Template not found")
        
        await self._validate_access(template, request.account_id)
        
        mcp_requirements = template.mcp_requirements
        
        if not request.profile_mappings:
            request.profile_mappings = await self._auto_map_profiles(
                mcp_requirements,
                request.account_id
            )
        
        missing_profiles, missing_configs = await self._validate_installation_requirements(
            mcp_requirements,
            request.profile_mappings,
            request.custom_mcp_configs
        )
        
        if missing_profiles or missing_configs:
            return TemplateInstallationResult(
                status='configs_required',
                missing_regular_credentials=missing_profiles,
                missing_custom_configs=missing_configs,
                template_info={
                    'template_id': template.template_id,
                    'name': template.name,
                    'description': template.description
                }
            )
        
        agent_config = await self._build_agent_config(
            template,
            request,
            mcp_requirements
        )
        
        agent_id = await self._create_agent(
            template,
            request,
            agent_config
        )
        
        await self._create_initial_version(
            agent_id,
            request.account_id,
            agent_config,
            request.custom_system_prompt or template.system_prompt
        )
        
        await self._restore_workflows(agent_id, template.config) 
        await self._increment_download_count(template.template_id)
        
        agent_name = request.instance_name or f"{template.name} (from marketplace)"
        logger.info(f"Successfully installed template {template.template_id} as agent {agent_id}")
        
        return TemplateInstallationResult(
            status='installed',
            instance_id=agent_id,
            name=agent_name
        )
    
    async def _get_template(self, template_id: str) -> Optional[AgentTemplate]:
        from .template_service import get_template_service
        template_service = get_template_service(self._db)
        return await template_service.get_template(template_id)
    
    async def _validate_access(self, template: AgentTemplate, user_id: str) -> None:
        if template.creator_id != user_id and not template.is_public:
            raise TemplateInstallationError("Access denied to template")
    
    async def _auto_map_profiles(
        self,
        requirements: List[MCPRequirementValue],
        account_id: str
    ) -> Dict[QualifiedName, ProfileId]:
        profile_mappings = {}
        
        for req in requirements:
            if not req.is_custom():
                from credentials import get_profile_service
                profile_service = get_profile_service(self._db)
                default_profile = await profile_service.get_default_profile(
                    account_id, req.qualified_name
                )
                
                if default_profile:
                    profile_mappings[req.qualified_name] = default_profile.profile_id
                    logger.info(f"Auto-mapped {req.qualified_name} to profile {default_profile.profile_id}")
        
        return profile_mappings
    
    async def _validate_installation_requirements(
        self,
        requirements: List[MCPRequirementValue],
        profile_mappings: Optional[Dict[QualifiedName, ProfileId]],
        custom_configs: Optional[Dict[QualifiedName, ConfigType]]
    ) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        missing_profiles = []
        missing_configs = []
        
        profile_mappings = profile_mappings or {}
        custom_configs = custom_configs or {}
        
        for req in requirements:
            if req.is_custom():
                if req.qualified_name not in custom_configs:
                    field_descriptions = {}
                    for field in req.required_config:
                        if field == 'url':
                            field_descriptions[field] = {
                                'type': 'text',
                                'placeholder': 'https://example.com/mcp/endpoint',
                                'description': f'The endpoint URL for the {req.display_name} MCP server'
                            }
                        else:
                            field_descriptions[field] = {
                                'type': 'text',
                                'placeholder': f'Enter {field}',
                                'description': f'Required configuration for {field}'
                            }
                    
                    missing_configs.append({
                        'qualified_name': req.qualified_name,
                        'display_name': req.display_name,
                        'required_config': req.required_config,
                        'custom_type': req.custom_type,
                        'field_descriptions': field_descriptions,
                        'toolkit_slug': req.toolkit_slug,
                        'app_slug': req.app_slug
                    })
            else:
                if req.qualified_name not in profile_mappings:
                    missing_profiles.append({
                        'qualified_name': req.qualified_name,
                        'display_name': req.display_name,
                        'enabled_tools': req.enabled_tools,
                        'required_config': req.required_config,
                        'custom_type': req.custom_type,
                        'toolkit_slug': req.toolkit_slug,
                        'app_slug': req.app_slug
                    })
        
        return missing_profiles, missing_configs
    
    async def _build_agent_config(
        self,
        template: AgentTemplate,
        request: TemplateInstallationRequest,
        requirements: List[MCPRequirementValue]
    ) -> Dict[str, Any]:
        agentpress_tools = {}
        template_agentpress = template.agentpress_tools or {}
        for tool_name, tool_config in template_agentpress.items():
            if isinstance(tool_config, dict):
                agentpress_tools[tool_name] = tool_config.get('enabled', True)
            else:
                agentpress_tools[tool_name] = tool_config
        
        agent_config = {
            'tools': {
                'agentpress': agentpress_tools,
                'mcp': [],
                'custom_mcp': []
            },
            'metadata': template.config.get('metadata', {}),
            'system_prompt': request.custom_system_prompt or template.system_prompt,
            'model': template.config.get('model')
        }
        
        from credentials import get_profile_service
        profile_service = get_profile_service(self._db)
        
        for req in requirements:
            if req.is_custom():
                config = request.custom_mcp_configs.get(req.qualified_name, {})
                
                original_name = req.display_name
                if req.qualified_name.startswith('custom_') and '_' in req.qualified_name[7:]:
                    parts = req.qualified_name.split('_', 2)
                    if len(parts) >= 3:
                        original_name = parts[2].replace('_', ' ').title()
                
                custom_mcp = {
                    'name': original_name,
                    'type': req.custom_type or 'sse',
                    'config': config,
                    'enabledTools': req.enabled_tools
                }
                agent_config['tools']['custom_mcp'].append(custom_mcp)
            else:
                profile_id = request.profile_mappings.get(req.qualified_name)
                if profile_id:
                    profile = await profile_service.get_profile(request.account_id, profile_id)
                    if profile:
                        if req.qualified_name.startswith('pipedream:'):
                            app_slug = req.app_slug or profile.config.get('app_slug')
                            if not app_slug:
                                app_slug = req.qualified_name.split(':')[1] if ':' in req.qualified_name else req.display_name.lower()
                            
                            pipedream_config = {
                                'url': 'https://remote.mcp.pipedream.net',
                                'headers': {
                                    'x-pd-app-slug': app_slug
                                },
                                'profile_id': profile_id
                            }
                            
                            mcp_config = {
                                'name': req.display_name,
                                'type': 'pipedream',
                                'config': pipedream_config,
                                'enabledTools': req.enabled_tools
                            }
                            agent_config['tools']['custom_mcp'].append(mcp_config)
                            
                        elif req.qualified_name.startswith('composio.') or 'composio' in req.qualified_name:
                            toolkit_slug = req.toolkit_slug
                            if not toolkit_slug:
                                toolkit_slug = req.qualified_name
                                if toolkit_slug.startswith('composio.'):
                                    toolkit_slug = toolkit_slug[9:]
                                elif 'composio_' in toolkit_slug:
                                    parts = toolkit_slug.split('composio_')
                                    toolkit_slug = parts[-1]
                            
                            composio_config = {
                                'name': req.display_name,
                                'type': 'composio',
                                'qualifiedName': req.qualified_name,
                                'toolkit_slug': toolkit_slug,
                                'config': {
                                    'profile_id': profile_id
                                },
                                'enabledTools': req.enabled_tools
                            }
                            agent_config['tools']['custom_mcp'].append(composio_config)
                        else:
                            mcp_config = {
                                'name': req.display_name or req.qualified_name,
                                'type': 'sse',
                                'config': profile.config,
                                'enabledTools': req.enabled_tools
                            }
                            agent_config['tools']['mcp'].append(mcp_config)
        
        return agent_config
    
    async def _create_agent(
        self,
        template: AgentTemplate,
        request: TemplateInstallationRequest,
        agent_config: Dict[str, Any]
    ) -> str:
        agent_id = str(uuid4())
        agent_name = request.instance_name or f"{template.name} (from marketplace)"
        
        client = await self._db.client
        
        agent_data = {
            'agent_id': agent_id,
            'account_id': request.account_id,
            'name': agent_name,
            'description': template.description,
            'avatar': template.avatar,
            'avatar_color': template.avatar_color,
            'profile_image_url': template.profile_image_url,
            'metadata': {
                **template.metadata,
                'created_from_template': template.template_id,
                'template_name': template.name
            },
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        
        await client.table('agents').insert(agent_data).execute()
        
        logger.info(f"Created agent {agent_id} from template {template.template_id}")
        return agent_id
    
    async def _create_initial_version(
        self,
        agent_id: str,
        user_id: str,
        agent_config: Dict[str, Any],
        system_prompt: str
    ) -> None:
        try:
            tools = agent_config.get('tools', {})
            configured_mcps = tools.get('mcp', [])
            custom_mcps = tools.get('custom_mcp', [])
            agentpress_tools = tools.get('agentpress', {})
            model = agent_config.get('model')
            
            from agent.versioning.version_service import get_version_service
            version_service = await get_version_service()
            await version_service.create_version(
                agent_id=agent_id,
                user_id=user_id,
                system_prompt=system_prompt,
                model=model,
                configured_mcps=configured_mcps,
                custom_mcps=custom_mcps,
                agentpress_tools=agentpress_tools,
                version_name="v1",
                change_description="Initial version from template"
            )
            
            logger.info(f"Created initial version for agent {agent_id}")
            
        except Exception as e:
            logger.warning(f"Failed to create initial version for agent {agent_id}: {e}")
    
    async def _restore_workflows(self, agent_id: str, template_config: Dict[str, Any]) -> None:
        workflows = template_config.get('workflows', [])
        if not workflows:
            logger.info(f"No workflows to restore for agent {agent_id}")
            return
            
        client = await self._db.client
        restored_count = 0
        
        for workflow in workflows:
            try:
                steps = workflow.get('steps', [])
                if steps:
                    steps = self._regenerate_step_ids(steps)

                workflow_data = {
                    'id': str(uuid4()),
                    'agent_id': agent_id,
                    'name': workflow.get('name', 'Untitled Workflow'),
                    'description': workflow.get('description'),
                    'status': workflow.get('status', 'draft'),
                    'trigger_phrase': workflow.get('trigger_phrase'),
                    'is_default': workflow.get('is_default', False),
                    'steps': steps,
                    'created_at': datetime.now(timezone.utc).isoformat(),
                    'updated_at': datetime.now(timezone.utc).isoformat()
                }
                
                result = await client.table('agent_workflows').insert(workflow_data).execute()
                if result.data:
                    restored_count += 1
                    logger.info(f"Restored workflow '{workflow_data['name']}' for agent {agent_id}")
                else:
                    logger.warning(f"Failed to insert workflow '{workflow_data['name']}' for agent {agent_id}")
                    
            except Exception as e:
                logger.error(f"Failed to restore workflow '{workflow.get('name', 'Unknown')}' for agent {agent_id}: {e}")
        
        logger.info(f"Successfully restored {restored_count}/{len(workflows)} workflows for agent {agent_id}")
    
    def _regenerate_step_ids(self, steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not steps:
            return []
        
        new_steps = []
        id_mapping = {}
        
        for step in steps:
            if not isinstance(step, dict):
                continue
                
            old_id = step.get('id')
            if old_id:
                if old_id not in id_mapping:
                    id_mapping[old_id] = f"step-{str(uuid4())[:8]}"
                new_id = id_mapping[old_id]
            else:
                new_id = f"step-{str(uuid4())[:8]}"
            
            new_step = {
                'id': new_id,
                'name': step.get('name', ''),
                'description': step.get('description', ''),
                'type': step.get('type', 'instruction'),
                'config': step.get('config', {}),
                'order': step.get('order', 0)
            }
            
            if 'conditions' in step:
                new_step['conditions'] = step['conditions']
            
            if 'children' in step and isinstance(step['children'], list):
                new_step['children'] = self._regenerate_step_ids(step['children'])
            else:
                new_step['children'] = []
            
            new_steps.append(new_step)
        
        return new_steps
    
    async def _increment_download_count(self, template_id: str) -> None:
        client = await self._db.client
        try:
            await client.rpc('increment_template_download_count', {
                'template_id_param': template_id
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to increment download count for template {template_id}: {e}")

def get_installation_service(db_connection: DBConnection) -> InstallationService:
    return InstallationService(db_connection) 