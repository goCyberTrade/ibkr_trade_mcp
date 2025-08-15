import json
from typing import Optional, Dict, Any, List
from agentpress.tool import ToolResult, openapi_schema, usage_example
from agentpress.thread_manager import ThreadManager
from .base_tool import AgentBuilderBaseTool
from utils.logger import logger
from datetime import datetime
from services.supabase import DBConnection
from triggers import get_trigger_service


class TriggerTool(AgentBuilderBaseTool):
    def __init__(self, thread_manager: ThreadManager, db_connection, agent_id: str):
        super().__init__(thread_manager, db_connection, agent_id)

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "create_scheduled_trigger",
            "description": "Create a scheduled trigger for the agent to execute workflows or direct agent runs using cron expressions. This allows the agent to run automatically at specified times.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Name of the scheduled trigger. Should be descriptive of when/why it runs."
                    },
                    "description": {
                        "type": "string",
                        "description": "Description of what this trigger does and when it runs."
                    },
                    "cron_expression": {
                        "type": "string",
                        "description": "Cron expression defining when to run (e.g., '0 9 * * *' for daily at 9am, '*/30 * * * *' for every 30 minutes)"
                    },
                    "execution_type": {
                        "type": "string",
                        "enum": ["workflow", "agent"],
                        "description": "Whether to execute a workflow or run the agent directly",
                        "default": "agent"
                    },
                    "workflow_id": {
                        "type": "string",
                        "description": "ID of the workflow to execute (required if execution_type is 'workflow')"
                    },
                    "workflow_input": {
                        "type": "object",
                        "description": "Input data to pass to the workflow (optional, only for workflow execution)",
                        "additionalProperties": True
                    },
                    "agent_prompt": {
                        "type": "string",
                        "description": "Prompt to send to the agent when triggered (required if execution_type is 'agent')"
                    }
                },
                "required": ["name", "cron_expression", "execution_type"]
            }
        }
    })
    @usage_example('''
        <function_calls>
        <invoke name="create_scheduled_trigger">
        <parameter name="name">Daily Report Generation</parameter>
        <parameter name="description">Generates daily reports every morning at 9 AM</parameter>
        <parameter name="cron_expression">0 9 * * *</parameter>
        <parameter name="execution_type">workflow</parameter>
        <parameter name="workflow_id">workflow-123</parameter>
        <parameter name="workflow_input">{"report_type": "daily", "include_charts": true}</parameter>
        </invoke>
        </function_calls>
        ''')
    async def create_scheduled_trigger(
        self,
        name: str,
        cron_expression: str,
        execution_type: str = "agent",
        description: Optional[str] = None,
        workflow_id: Optional[str] = None,
        workflow_input: Optional[Dict[str, Any]] = None,
        agent_prompt: Optional[str] = None
    ) -> ToolResult:
        try:
            if execution_type not in ["workflow", "agent"]:
                return self.fail_response("execution_type must be either 'workflow' or 'agent'")
            
            if execution_type == "workflow" and not workflow_id:
                return self.fail_response("workflow_id is required when execution_type is 'workflow'")
            
            if execution_type == "agent" and not agent_prompt:
                return self.fail_response("agent_prompt is required when execution_type is 'agent'")
            
            if execution_type == "workflow":
                client = await self.db.client
                workflow_result = await client.table('agent_workflows').select('*').eq('id', workflow_id).eq('agent_id', self.agent_id).execute()
                if not workflow_result.data:
                    return self.fail_response(f"Workflow {workflow_id} not found or doesn't belong to this agent")
                
                workflow = workflow_result.data[0]
                if workflow['status'] != 'active':
                    return self.fail_response(f"Workflow '{workflow['name']}' is not active. Please activate it first.")
            
            trigger_config = {
                "cron_expression": cron_expression,
                "execution_type": execution_type,
                "provider_id": "schedule"
            }
            
            if execution_type == "workflow":
                trigger_config["workflow_id"] = workflow_id
                if workflow_input:
                    trigger_config["workflow_input"] = workflow_input
            else:
                trigger_config["agent_prompt"] = agent_prompt
            
            trigger_svc = get_trigger_service(self.db)
            
            try:
                trigger = await trigger_svc.create_trigger(
                    agent_id=self.agent_id,
                    provider_id="schedule",
                    name=name,
                    config=trigger_config,
                    description=description
                )
                
                result_message = f"Scheduled trigger '{name}' created successfully!\n\n"
                result_message += f"**Schedule**: {cron_expression}\n"
                result_message += f"**Type**: {execution_type.capitalize()} execution\n"
                
                if execution_type == "workflow":
                    result_message += f"**Workflow**: {workflow['name']}\n"
                    if workflow_input:
                        result_message += f"**Input Data**: {json.dumps(workflow_input, indent=2)}\n"
                else:
                    result_message += f"**Prompt**: {agent_prompt}\n"
                
                result_message += f"\nThe trigger is now active and will run according to the schedule."
                
                return self.success_response({
                    "message": result_message,
                    "trigger": {
                        "id": trigger.trigger_id,
                        "name": trigger.name,
                        "description": trigger.description,
                        "cron_expression": cron_expression,
                        "execution_type": execution_type,
                        "is_active": trigger.is_active,
                        "created_at": trigger.created_at.isoformat()
                    }
                })
            except ValueError as ve:
                return self.fail_response(f"Validation error: {str(ve)}")
            except Exception as e:
                logger.error(f"Error creating trigger through manager: {str(e)}")
                return self.fail_response(f"Failed to create trigger: {str(e)}")
                    
        except Exception as e:
            logger.error(f"Error creating scheduled trigger: {str(e)}")
            return self.fail_response(f"Error creating scheduled trigger: {str(e)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "get_scheduled_triggers",
            "description": "Get all scheduled triggers for the current agent. Shows when the agent will run automatically.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    })
    @usage_example('''
        <function_calls>
        <invoke name="get_scheduled_triggers">
        </invoke>
        </function_calls>
        ''')
    async def get_scheduled_triggers(self) -> ToolResult:
        try:
            from triggers import TriggerType
            
            trigger_svc = get_trigger_service(self.db)
            
            triggers = await trigger_svc.get_agent_triggers(self.agent_id)
            
            schedule_triggers = [t for t in triggers if t.trigger_type == TriggerType.SCHEDULE]
            
            if not schedule_triggers:
                return self.success_response({
                    "message": "No scheduled triggers found for this agent.",
                    "triggers": []
                })
            
            client = await self.db.client
            workflows = {}
            for trigger in schedule_triggers:
                if trigger.config.get("execution_type") == "workflow" and trigger.config.get("workflow_id"):
                    workflow_id = trigger.config["workflow_id"]
                    if workflow_id not in workflows:
                        workflow_result = await client.table('agent_workflows').select('name').eq('id', workflow_id).execute()
                        if workflow_result.data:
                            workflows[workflow_id] = workflow_result.data[0]['name']
            
            formatted_triggers = []
            for trigger in schedule_triggers:
                formatted = {
                    "id": trigger.trigger_id,
                    "name": trigger.name,
                    "description": trigger.description,
                    "cron_expression": trigger.config.get("cron_expression"),
                    "execution_type": trigger.config.get("execution_type", "agent"),
                    "is_active": trigger.is_active,
                    "created_at": trigger.created_at.isoformat()
                }
                
                if trigger.config.get("execution_type") == "workflow":
                    workflow_id = trigger.config.get("workflow_id")
                    formatted["workflow_name"] = workflows.get(workflow_id, "Unknown Workflow")
                    formatted["workflow_input"] = trigger.config.get("workflow_input")
                else:
                    formatted["agent_prompt"] = trigger.config.get("agent_prompt")
                
                formatted_triggers.append(formatted)
            
            return self.success_response({
                "message": f"Found {len(formatted_triggers)} scheduled trigger(s)",
                "triggers": formatted_triggers
            })
                    
        except Exception as e:
            logger.error(f"Error getting scheduled triggers: {str(e)}")
            return self.fail_response(f"Error getting scheduled triggers: {str(e)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "delete_scheduled_trigger",
            "description": "Delete a scheduled trigger. The agent will no longer run automatically at the scheduled time.",
            "parameters": {
                "type": "object",
                "properties": {
                    "trigger_id": {
                        "type": "string",
                        "description": "ID of the trigger to delete"
                    }
                },
                "required": ["trigger_id"]
            }
        }
    })
    @usage_example('''
        <function_calls>
        <invoke name="delete_scheduled_trigger">
        <parameter name="trigger_id">trigger-123</parameter>
        </invoke>
        </function_calls>
        ''')
    async def delete_scheduled_trigger(self, trigger_id: str) -> ToolResult:
        try:
            trigger_svc = get_trigger_service(self.db)
            
            trigger_config = await trigger_svc.get_trigger(trigger_id)
            
            if not trigger_config:
                return self.fail_response("Trigger not found")
            
            if trigger_config.agent_id != self.agent_id:
                return self.fail_response("This trigger doesn't belong to the current agent")
            
            success = await trigger_svc.delete_trigger(trigger_id)
            
            if success:
                return self.success_response({
                    "message": f"Scheduled trigger '{trigger_config.name}' deleted successfully",
                    "trigger_id": trigger_id
                })
            else:
                return self.fail_response("Failed to delete trigger")
                    
        except Exception as e:
            logger.error(f"Error deleting scheduled trigger: {str(e)}")
            return self.fail_response(f"Error deleting scheduled trigger: {str(e)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "toggle_scheduled_trigger",
            "description": "Enable or disable a scheduled trigger. Disabled triggers won't run until re-enabled.",
            "parameters": {
                "type": "object",
                "properties": {
                    "trigger_id": {
                        "type": "string",
                        "description": "ID of the trigger to toggle"
                    },
                    "is_active": {
                        "type": "boolean",
                        "description": "Whether to enable (true) or disable (false) the trigger"
                    }
                },
                "required": ["trigger_id", "is_active"]
            }
        }
    })
    @usage_example('''
        <function_calls>
        <invoke name="toggle_scheduled_trigger">
        <parameter name="trigger_id">trigger-123</parameter>
        <parameter name="is_active">false</parameter>
        </invoke>
        </function_calls>
        ''')
    async def toggle_scheduled_trigger(self, trigger_id: str, is_active: bool) -> ToolResult:
        try:
            trigger_svc = get_trigger_service(self.db)
            
            trigger_config = await trigger_svc.get_trigger(trigger_id)
            
            if not trigger_config:
                return self.fail_response("Trigger not found")
            
            if trigger_config.agent_id != self.agent_id:
                return self.fail_response("This trigger doesn't belong to the current agent")
            
            updated_config = await trigger_svc.update_trigger(
                trigger_id=trigger_id,
                is_active=is_active
            )
            
            if updated_config:
                status = "enabled" if is_active else "disabled"
                return self.success_response({
                    "message": f"Scheduled trigger '{updated_config.name}' has been {status}",
                    "trigger": {
                        "id": updated_config.trigger_id,
                        "name": updated_config.name,
                        "is_active": updated_config.is_active
                    }
                })
            else:
                return self.fail_response("Failed to update trigger")
                    
        except Exception as e:
            logger.error(f"Error toggling scheduled trigger: {str(e)}")
            return self.fail_response(f"Error toggling scheduled trigger: {str(e)}")
