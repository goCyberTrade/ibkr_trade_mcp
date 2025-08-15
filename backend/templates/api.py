from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from utils.logger import logger
from utils.auth_utils import get_current_user_id_from_jwt
from services.supabase import DBConnection

from .template_service import (
    get_template_service,
    AgentTemplate,
    TemplateNotFoundError,
    TemplateAccessDeniedError,
    SunaDefaultAgentTemplateError
)
from .installation_service import (
    get_installation_service,
    TemplateInstallationRequest,
    TemplateInstallationResult,
    TemplateInstallationError,
    InvalidCredentialError
)
from .utils import format_template_for_response

router = APIRouter()

db: Optional[DBConnection] = None


class CreateTemplateRequest(BaseModel):
    agent_id: str
    make_public: bool = False
    tags: Optional[List[str]] = None


class InstallTemplateRequest(BaseModel):
    template_id: str
    instance_name: Optional[str] = None
    custom_system_prompt: Optional[str] = None
    profile_mappings: Optional[Dict[str, str]] = None
    custom_mcp_configs: Optional[Dict[str, Dict[str, Any]]] = None


class PublishTemplateRequest(BaseModel):
    tags: Optional[List[str]] = None


class TemplateResponse(BaseModel):
    template_id: str
    creator_id: str
    name: str
    description: Optional[str] = None
    system_prompt: str
    mcp_requirements: List[Dict[str, Any]]
    agentpress_tools: Dict[str, Any]
    tags: List[str]
    is_public: bool
    is_kortix_team: Optional[bool] = False
    marketplace_published_at: Optional[str] = None
    download_count: int
    created_at: str
    updated_at: str
    avatar: Optional[str]
    avatar_color: Optional[str]
    profile_image_url: Optional[str] = None
    metadata: Dict[str, Any]
    creator_name: Optional[str] = None


class InstallationResponse(BaseModel):
    status: str
    instance_id: Optional[str] = None
    name: Optional[str] = None
    missing_regular_credentials: List[Dict[str, Any]] = []
    missing_custom_configs: List[Dict[str, Any]] = []
    template_info: Optional[Dict[str, Any]] = None


def initialize(database: DBConnection):
    global db
    db = database


async def validate_template_ownership_and_get(template_id: str, user_id: str) -> AgentTemplate:
    """
    Validates that the user owns the template and returns it.
    
    Args:
        template_id: The template ID to validate
        user_id: The user ID to check ownership for
        
    Returns:
        AgentTemplate: The template if the user owns it
        
    Raises:
        HTTPException: If template not found or user doesn't own it
    """
    template_service = get_template_service(db)
    template = await template_service.get_template(template_id)
    
    if not template:
        logger.warning(f"Template {template_id} not found")
        raise HTTPException(status_code=404, detail="Template not found")
    
    if template.creator_id != user_id:
        logger.warning(f"User {user_id} attempted to access template {template_id} owned by {template.creator_id}")
        raise HTTPException(status_code=403, detail="You don't have permission to access this template")
    
    return template


async def validate_template_access_and_get(template_id: str, user_id: str) -> AgentTemplate:
    """
    Validates that the user can access the template (either owns it or it's public) and returns it.
    
    Args:
        template_id: The template ID to validate
        user_id: The user ID to check access for
        
    Returns:
        AgentTemplate: The template if the user can access it
        
    Raises:
        HTTPException: If template not found or user can't access it
    """
    template_service = get_template_service(db)
    template = await template_service.get_template(template_id)
    
    if not template:
        logger.warning(f"Template {template_id} not found")
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Check if user can access the template (owner or public)
    if template.creator_id != user_id and not template.is_public:
        logger.warning(f"User {user_id} attempted to access private template {template_id} owned by {template.creator_id}")
        raise HTTPException(status_code=403, detail="Access denied to private template")
    
    return template


async def validate_agent_ownership(agent_id: str, user_id: str) -> Dict[str, Any]:
    """
    Validates that the user owns the agent and returns it.
    
    Args:
        agent_id: The agent ID to validate
        user_id: The user ID to check ownership for
        
    Returns:
        Dict[str, Any]: The agent data if the user owns it
        
    Raises:
        HTTPException: If agent not found or user doesn't own it
    """
    template_service = get_template_service(db)
    agent = await template_service._get_agent_by_id(agent_id)
    
    if not agent:
        logger.warning(f"Agent {agent_id} not found")
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if agent['account_id'] != user_id:
        logger.warning(f"User {user_id} attempted to access agent {agent_id} owned by {agent['account_id']}")
        raise HTTPException(status_code=403, detail="You don't have permission to access this agent")
    
    return agent


@router.post("", response_model=Dict[str, str])
async def create_template_from_agent(
    request: CreateTemplateRequest,
    user_id: str = Depends(get_current_user_id_from_jwt)
):
    """
    Create a template from an existing agent.
    
    Requires:
    - User must own the agent
    - Agent cannot be a Suna default agent
    """
    try:
        # Validate agent ownership first
        await validate_agent_ownership(request.agent_id, user_id)
        
        logger.info(f"User {user_id} creating template from agent {request.agent_id}")
        
        template_service = get_template_service(db)
        
        template_id = await template_service.create_from_agent(
            agent_id=request.agent_id,
            creator_id=user_id,
            make_public=request.make_public,
            tags=request.tags
        )
        
        logger.info(f"Successfully created template {template_id} from agent {request.agent_id}")
        return {"template_id": template_id}
        
    except HTTPException:
        # Re-raise HTTP exceptions from our validation functions
        raise
    except TemplateNotFoundError as e:
        logger.warning(f"Template creation failed - not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except TemplateAccessDeniedError as e:
        logger.warning(f"Template creation failed - access denied: {e}")
        raise HTTPException(status_code=403, detail=str(e))
    except SunaDefaultAgentTemplateError as e:
        logger.warning(f"Template creation failed - Suna default agent: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating template from agent {request.agent_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{template_id}/publish")
async def publish_template(
    template_id: str,
    request: PublishTemplateRequest,
    user_id: str = Depends(get_current_user_id_from_jwt)
):
    """
    Publish a template to the marketplace.
    
    Requires:
    - User must own the template
    """
    try:
        # Validate template ownership first
        template = await validate_template_ownership_and_get(template_id, user_id)
        
        logger.info(f"User {user_id} publishing template {template_id}")
        
        template_service = get_template_service(db)
        
        success = await template_service.publish_template(template_id, user_id)
        
        if not success:
            logger.warning(f"Failed to publish template {template_id} for user {user_id}")
            raise HTTPException(status_code=500, detail="Failed to publish template")
        
        logger.info(f"Successfully published template {template_id}")
        return {"message": "Template published successfully"}
        
    except HTTPException:
        # Re-raise HTTP exceptions from our validation functions
        raise
    except Exception as e:
        logger.error(f"Error publishing template {template_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{template_id}/unpublish")
async def unpublish_template(
    template_id: str,
    user_id: str = Depends(get_current_user_id_from_jwt)
):
    """
    Unpublish a template from the marketplace.
    
    Requires:
    - User must own the template
    """
    try:
        # Validate template ownership first
        template = await validate_template_ownership_and_get(template_id, user_id)
        
        logger.info(f"User {user_id} unpublishing template {template_id}")
        
        template_service = get_template_service(db)
        
        success = await template_service.unpublish_template(template_id, user_id)
        
        if not success:
            logger.warning(f"Failed to unpublish template {template_id} for user {user_id}")
            raise HTTPException(status_code=500, detail="Failed to unpublish template")
        
        logger.info(f"Successfully unpublished template {template_id}")
        return {"message": "Template unpublished successfully"}
        
    except HTTPException:
        # Re-raise HTTP exceptions from our validation functions
        raise
    except Exception as e:
        logger.error(f"Error unpublishing template {template_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    user_id: str = Depends(get_current_user_id_from_jwt)
):
    """
    Delete a template.
    
    Requires:
    - User must own the template
    """
    try:
        # Validate template ownership first
        template = await validate_template_ownership_and_get(template_id, user_id)
        
        logger.info(f"User {user_id} deleting template {template_id}")
        
        template_service = get_template_service(db)
        
        success = await template_service.delete_template(template_id, user_id)
        
        if not success:
            logger.warning(f"Failed to delete template {template_id} for user {user_id}")
            raise HTTPException(status_code=500, detail="Failed to delete template")
        
        logger.info(f"Successfully deleted template {template_id}")
        return {"message": "Template deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting template {template_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/install", response_model=InstallationResponse)
async def install_template(
    request: InstallTemplateRequest,
    user_id: str = Depends(get_current_user_id_from_jwt)
):
    try:
        await validate_template_access_and_get(request.template_id, user_id)
        client = await db.client
        from agent.utils import check_agent_count_limit
        limit_check = await check_agent_count_limit(client, user_id)
        
        if not limit_check['can_create']:
            error_detail = {
                "message": f"Maximum of {limit_check['limit']} agents allowed for your current plan. You have {limit_check['current_count']} agents.",
                "current_count": limit_check['current_count'],
                "limit": limit_check['limit'],
                "tier_name": limit_check['tier_name'],
                "error_code": "AGENT_LIMIT_EXCEEDED"
            }
            logger.warning(f"Agent limit exceeded for account {user_id}: {limit_check['current_count']}/{limit_check['limit']} agents")
            raise HTTPException(status_code=402, detail=error_detail)
        
        logger.info(f"User {user_id} installing template {request.template_id}")
        
        installation_service = get_installation_service(db)
        
        install_request = TemplateInstallationRequest(
            template_id=request.template_id,
            account_id=user_id,
            instance_name=request.instance_name,
            custom_system_prompt=request.custom_system_prompt,
            profile_mappings=request.profile_mappings,
            custom_mcp_configs=request.custom_mcp_configs
        )
        
        result = await installation_service.install_template(install_request)
        
        logger.info(f"Successfully installed template {request.template_id} as instance {result.instance_id}")
        
        return InstallationResponse(
            status=result.status,
            instance_id=result.instance_id,
            name=result.name,
            missing_regular_credentials=result.missing_regular_credentials,
            missing_custom_configs=result.missing_custom_configs,
            template_info=result.template_info
        )
        
    except HTTPException:
        raise
    except TemplateInstallationError as e:
        logger.warning(f"Template installation failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except InvalidCredentialError as e:
        logger.warning(f"Template installation failed - invalid credentials: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error installing template {request.template_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/marketplace", response_model=List[TemplateResponse])
async def get_marketplace_templates(
    limit: Optional[int] = Query(None, description="Maximum number of templates to return"),
    offset: Optional[int] = Query(0, description="Number of templates to skip"),
    search: Optional[str] = Query(None, description="Search term for name and description"),
    tags: Optional[str] = Query(None, description="Comma-separated list of tags to filter by"),
    is_kortix_team: Optional[bool] = Query(None, description="Filter for Kortix team templates")
):
    try:
        logger.info(
            f"Fetching marketplace templates with filters - "
            f"limit: {limit}, offset: {offset}, search: {search}, "
            f"tags: {tags}, is_kortix_team: {is_kortix_team}"
        )
        
        template_service = get_template_service(db)

        tag_list = None
        if tags:
            tag_list = [tag.strip() for tag in tags.split(',') if tag.strip()]
        
        templates = await template_service.get_public_templates(
            is_kortix_team=is_kortix_team,
            limit=limit,
            offset=offset,
            search=search,
            tags=tag_list
        )
        
        logger.info(f"Retrieved {len(templates)} marketplace templates")
        return [
            TemplateResponse(**format_template_for_response(template))
            for template in templates
        ]
        
    except Exception as e:
        logger.error(f"Error getting marketplace templates: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/my", response_model=List[TemplateResponse])
async def get_my_templates(
    user_id: str = Depends(get_current_user_id_from_jwt)
):
    """
    Get all templates owned by the current user.
    
    Requires:
    - Valid authentication
    """
    try:
        logger.info(f"User {user_id} fetching their templates")
        
        template_service = get_template_service(db)
        templates = await template_service.get_user_templates(user_id)
        
        logger.info(f"Retrieved {len(templates)} templates for user {user_id}")
        
        return [
            TemplateResponse(**format_template_for_response(template))
            for template in templates
        ]
        
    except Exception as e:
        logger.error(f"Error getting templates for user {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: str,
    user_id: str = Depends(get_current_user_id_from_jwt)
):
    """
    Get a specific template by ID.
    
    Requires:
    - User must have access to the template (own it or it's public)
    """
    try:
        # Validate template access first
        template = await validate_template_access_and_get(template_id, user_id)
        
        logger.info(f"User {user_id} accessing template {template_id}")
        
        return TemplateResponse(**format_template_for_response(template))
        
    except HTTPException:
        # Re-raise HTTP exceptions from our validation functions
        raise
    except TemplateAccessDeniedError as e:
        logger.warning(f"Access denied to template {template_id} for user {user_id}: {e}")
        raise HTTPException(status_code=403, detail="Access denied to template")
    except Exception as e:
        logger.error(f"Error getting template {template_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error") 