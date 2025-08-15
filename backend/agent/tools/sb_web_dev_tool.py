import json
import asyncio
from typing import Optional, List, Dict, Any
from pathlib import Path
import time
from uuid import uuid4

from agentpress.tool import ToolResult, openapi_schema, usage_example
from agentpress.thread_manager import ThreadManager
from sandbox.tool_base import SandboxToolsBase
from utils.logger import logger


class SandboxWebDevTool(SandboxToolsBase):
    WORKSPACE_PATH = "/workspace"
    TEMPLATE_DIR = "/opt/templates/next-app"
    DEFAULT_TIMEOUT = 60
    BUILD_TIMEOUT = 1800
    INSTALL_TIMEOUT = 900
    DEFAULT_PORT = 3000

    def __init__(self, project_id: str, thread_id: str, thread_manager: ThreadManager):
        super().__init__(project_id, thread_manager)
        self.thread_id = thread_id
        self._sessions: Dict[str, str] = {}
        self.workspace_path = self.WORKSPACE_PATH

    async def _ensure_session(self, session_name: str = "default") -> str:
        if session_name not in self._sessions:
            session_id = str(uuid4())
            try:
                await self._ensure_sandbox()
                await self.sandbox.process.create_session(session_id)
                self._sessions[session_name] = session_id
            except Exception as e:
                raise RuntimeError(f"Failed to create session: {str(e)}")
        return self._sessions[session_name]

    async def _execute_command(self, command: str, timeout: int = DEFAULT_TIMEOUT) -> Dict[str, Any]:
        session_id = await self._ensure_session("web_dev_commands")
        from daytona_sdk import SessionExecuteRequest
        
        req = SessionExecuteRequest(
            command=command,
            var_async=False,
            cwd=self.workspace_path
        )
        
        response = await self.sandbox.process.execute_session_command(
            session_id=session_id,
            req=req,
            timeout=timeout
        )
        
        logs = await self.sandbox.process.get_session_command_logs(
            session_id=session_id,
            command_id=response.cmd_id
        )
        
        return {
            "output": logs,
            "exit_code": response.exit_code
        }

    async def _exec_sh(self, command: str, timeout: int = DEFAULT_TIMEOUT) -> Dict[str, Any]:
        await self._ensure_sandbox()
        resp = await self.sandbox.process.exec(f"/bin/sh -c \"{command}\"", timeout=timeout)
        output = getattr(resp, "result", None) or getattr(resp, "output", "") or ""
        return {"exit_code": getattr(resp, "exit_code", 1), "output": output}

    async def _run_in_tmux_background(self, session: str, command: str) -> None:
        await self._ensure_sandbox()
        await self._exec_sh(f"tmux has-session -t {session} 2>/dev/null || tmux new-session -d -s {session}")
        escaped = command.replace('"', '\\"')
        await self._exec_sh(f"tmux send-keys -t {session} \"cd {self.workspace_path} && {escaped}\" C-m")

    def _get_project_path(self, project_name: str) -> str:
        return f"{self.workspace_path}/{project_name}"

    async def _project_exists(self, project_name: str) -> bool:
        check_result = await self._exec_sh(f"test -f {self._get_project_path(project_name)}/package.json && echo OK || echo MISS")
        return "OK" in check_result.get("output", "")

    async def _has_src_directory(self, project_path: str) -> bool:
        src_check = await self._exec_sh(f"test -d {project_path}/src && echo YES || echo NO")
        return "YES" in src_check.get("output", "")

    def _get_package_manager_command(self, package_manager: str, command_type: str, additional_args: str = "") -> str:
        commands = {
            "pnpm": {
                "install": f"pnpm install --prefer-offline {additional_args}",
                "add": f"pnpm add {additional_args}",
                "add_dev": f"pnpm add -D {additional_args}",
                "build": "pnpm run build",
                "dev": "pnpm run dev",
                "start": "pnpm run start"
            },
            "npm": {
                "install": f"npm install --no-audit --no-fund --progress=false {additional_args}",
                "add": f"npm install --save {additional_args}",
                "add_dev": f"npm install --save-dev {additional_args}",
                "build": "npm run build",
                "dev": "npm run dev",
                "start": "npm run start"
            }
        }
        return commands.get(package_manager, commands["npm"]).get(command_type, "")

    async def _has_optimized_template(self) -> bool:
        dir_check = await self._exec_sh(f"test -d {self.TEMPLATE_DIR} && echo EXISTS || echo MISSING")
        if "MISSING" in dir_check.get("output", ""):
            logger.info(f"Template directory {self.TEMPLATE_DIR} does not exist")
            return False
        
        checks = [
            (f"test -f {self.TEMPLATE_DIR}/package.json", "package.json"),
            (f"test -f {self.TEMPLATE_DIR}/components.json", "components.json"), 
            (f"test -f {self.TEMPLATE_DIR}/tailwind.config.ts", "tailwind.config.ts"),
            (f"test -d {self.TEMPLATE_DIR}/src/components/ui", "src/components/ui directory")
        ]
        
        missing_files = []
        for check_cmd, file_desc in checks:
            result = await self._exec_sh(check_cmd)
            if result.get("exit_code") != 0:
                missing_files.append(file_desc)
        
        if missing_files:
            logger.info(f"Template missing files: {', '.join(missing_files)}")
            # Let's also check what files ARE available for debugging
            ls_result = await self._exec_sh(f"ls -la {self.TEMPLATE_DIR}")
            logger.info(f"Template directory contents: {ls_result.get('output', 'Could not list')}")
            return False
        
        logger.info("Optimized template found and validated")
        return True

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "debug_template_status",
            "description": "Debug helper to check the current state of the optimized template",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    })
    async def debug_template_status(self) -> ToolResult:
        try:
            await self._ensure_sandbox()
            
            debug_info = []
            
            dir_check = await self._exec_sh(f"test -d {self.TEMPLATE_DIR} && echo EXISTS || echo MISSING")
            debug_info.append(f"Template directory ({self.TEMPLATE_DIR}): {dir_check.get('output', 'Unknown')}")
            
            if "EXISTS" in dir_check.get("output", ""):
                ls_result = await self._exec_sh(f"ls -la {self.TEMPLATE_DIR}")
                debug_info.append(f"Directory contents:\n{ls_result.get('output', 'Could not list')}")
                
                files_to_check = [
                    "package.json",
                    "components.json", 
                    "tailwind.config.ts",
                    "src/components/ui"
                ]
                
                for file_path in files_to_check:
                    full_path = f"{self.TEMPLATE_DIR}/{file_path}"
                    if file_path.endswith("/ui"):
                        check_cmd = f"test -d {full_path} && echo DIR_EXISTS || echo DIR_MISSING"
                    else:
                        check_cmd = f"test -f {full_path} && echo FILE_EXISTS || echo FILE_MISSING"
                    
                    result = await self._exec_sh(check_cmd)
                    debug_info.append(f"{file_path}: {result.get('output', 'Unknown')}")
            
            has_template = await self._has_optimized_template()
            debug_info.append(f"Template detection result: {'✅ PASS' if has_template else '❌ FAIL'}")
            
            return self.success_response("\n".join(debug_info))
            
        except Exception as e:
            logger.error(f"Error debugging template: {e}", exc_info=True)
            return self.fail_response(f"Error debugging template: {e}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "list_web_projects",
            "description": "List all web projects in the workspace directory. Shows Node.js/React/Next.js projects with their types.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    })
    @usage_example('''
        <!-- List all web projects in the workspace -->
        <function_calls>
        <invoke name="list_web_projects">
        </invoke>
        </function_calls>
        ''')
    async def list_web_projects(self) -> ToolResult:
        try:
            await self._ensure_sandbox()
            
            list_cmd = f"ls -la {self.workspace_path} | grep ^d | awk '{{print $NF}}' | grep -v '^\\.$' | grep -v '^\\.\\.\\$'"
            result = await self._execute_command(list_cmd)
            output = result.get("output", "")
            
            if result.get("exit_code") != 0 or not output:
                list_cmd = f"ls -d {self.workspace_path}/*/ 2>/dev/null | xargs -n1 basename 2>/dev/null || echo 'No projects found'"
                result = await self._execute_command(list_cmd)
                output = result.get("output", "")
            
            projects = output.strip().split('\n') if output else []
            projects = [p for p in projects if p and p != 'No projects found']
            
            if not projects:
                return self.success_response("""
📁 No projects found in workspace.

To create a new project, use create_web_project:
- Next.js with shadcn/ui: All components pre-installed and ready to use!
- React: npx create-react-app my-app --template typescript
- Vite: npm create vite@latest my-app -- --template react-ts
""")

            project_info = []
            for project in projects:
                project_path = self._get_project_path(project)
                package_check = f"test -f {project_path}/package.json && echo '__HAS_PACKAGE__' || echo '__NO_PACKAGE__'"
                package_result = await self._execute_command(package_check)
                
                if "__HAS_PACKAGE__" in package_result.get("output", ""):
                    cat_cmd = f"cat {project_path}/package.json 2>/dev/null | grep -E '\"(next|react|vite)\"' | head -1"
                    cat_result = await self._execute_command(cat_cmd)
                    
                    project_type = "Node.js project"
                    output_lower = cat_result.get("output", "").lower()
                    if "next" in output_lower:
                        project_type = "Next.js project (with shadcn/ui)"
                    elif "react" in output_lower:
                        project_type = "React project"
                    elif "vite" in output_lower:
                        project_type = "Vite project"
                    
                    project_info.append(f"  📦 {project} ({project_type})")
                else:
                    project_info.append(f"  📁 {project} (Directory)")

            return self.success_response(f"""
📁 Projects found in workspace:

{chr(10).join(project_info)}

Total: {len(projects)} project(s)

Use 'get_project_structure' to view project files.
To run a project, use start_server or execute_command with: cd project-name && npm run dev
""")

        except Exception as e:
            logger.error(f"Error listing projects: {str(e)}", exc_info=True)
            return self.fail_response(f"Error listing projects: {str(e)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "get_project_structure",
            "description": "Get the file structure of a web project, showing important files and directories.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_name": {"type": "string", "description": "Name of the project directory to examine"},
                    "max_depth": {"type": "integer", "description": "Maximum depth to traverse (default: 3)", "default": 3}
                },
                "required": ["project_name"]
            }
        }
    })
    @usage_example('''
        <!-- Get structure of a project -->
        <function_calls>
        <invoke name="get_project_structure">
        <parameter name="project_name">my-app</parameter>
        </invoke>
        </function_calls>
        ''')
    async def get_project_structure(self, project_name: str, max_depth: int = 3) -> ToolResult:
        try:
            await self._ensure_sandbox()
            project_path = self._get_project_path(project_name)
            
            check_cmd = f"test -d {project_path} && echo '__DIR_EXISTS__' || echo '__DIR_MISSING__'"
            check_result = await self._execute_command(check_cmd)
            
            if "__DIR_MISSING__" in check_result.get("output", ""):
                return self.fail_response(f"Project '{project_name}' not found.")

            tree_cmd = (
                f"cd {project_path} && find . -maxdepth {max_depth} -type f -o -type d | "
                "grep -v node_modules | grep -v '\\.next' | grep -v '\\.git' | grep -v 'dist' | sort"
            )
            tree_result = await self._execute_command(tree_cmd)
            
            if tree_result.get("exit_code") != 0:
                return self.fail_response(f"Failed to get project structure: {tree_result.get('output')}")

            structure = tree_result.get("output", "")

            package_info = ""
            package_cmd = f"test -f {project_path}/package.json && cat {project_path}/package.json | grep -E '\"(name|version|scripts)\"' -A 5 | head -20"
            package_result = await self._execute_command(package_cmd)
            
            if package_result.get("exit_code") == 0:
                package_info = f"\n\n📋 Package.json info:\n{package_result.get('output', '')}"

            return self.success_response(f"""
📁 Project structure for '{project_name}':

{structure}
{package_info}

To run this project:
1. Use install_dependencies if needed
2. Use start_server (mode='dev' or 'prod')
3. Use expose_port to make it publicly accessible (start_server returns the preview URL)
""")

        except Exception as e:
            logger.error(f"Error getting project structure: {str(e)}", exc_info=True)
            return self.fail_response(f"Error getting project structure: {str(e)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "create_web_project",
            "description": "Create a new Next.js project with shadcn/ui and ALL components pre-installed from optimized template. Fast scaffolding with everything ready to use!",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_name": {"type": "string", "description": "Project directory name to create"},
                    "package_manager": {"type": "string", "description": "Package manager: pnpm|npm", "default": "pnpm"}
                },
                "required": ["project_name"]
            }
        }
    })
    @usage_example('''
        <!-- Create a new Next.js project with shadcn/ui pre-configured -->
        <function_calls>
        <invoke name="create_web_project">
        <parameter name="project_name">my-portfolio</parameter>
        <parameter name="package_manager">pnpm</parameter>
        </invoke>
        </function_calls>
        ''')
    async def create_web_project(self, project_name: str, package_manager: str = "pnpm") -> ToolResult:
        try:
            await self._ensure_sandbox()
            
            proj_dir = self._get_project_path(project_name)
            already = await self._exec_sh(f"test -e {proj_dir} && echo __EXISTS__ || echo __NEW__")
            if "__EXISTS__" in already.get("output", ""):
                return self.fail_response(f"Path '{project_name}' already exists")

            has_template = await self._has_optimized_template()
            
            if has_template:
                copy = await self._exec_sh(f"cp -R {self.TEMPLATE_DIR} {proj_dir}")
                if copy["exit_code"] != 0:
                    return self.fail_response(f"Failed to copy template: {copy['output']}")
                
                install_cmd = self._get_package_manager_command(package_manager, "install")
                install = await self._exec_sh(f"cd {proj_dir} && {install_cmd}", timeout=self.INSTALL_TIMEOUT)
                
                if install["exit_code"] != 0:
                    return self.fail_response(f"Dependency install failed: {install['output']}")

                return self.success_response({
                    "message": f"Project '{project_name}' created successfully with Next.js 15 + shadcn/ui pre-configured and ALL components ready to use!",
                    "project": project_name,
                    "features": [
                        "✅ Next.js 15 with TypeScript",
                        "✅ Tailwind CSS configured", 
                        "✅ shadcn/ui initialized",
                        "✅ ALL shadcn components pre-installed",
                        "✅ App Router with src/ directory",
                        "✅ ESLint configured"
                    ]
                })
            else:
                if package_manager == "pnpm":
                    scaffold_cmd = (
                        f"cd {self.workspace_path} && "
                        f"pnpm dlx create-next-app@15 {project_name} --ts --eslint --tailwind --app --src-dir --import-alias '@/*' --use-pnpm"
                    )
                else:
                    scaffold_cmd = (
                        f"cd {self.workspace_path} && "
                        f"npx create-next-app@15 {project_name} --ts --eslint --tailwind --app --src-dir --import-alias '@/*' --use-npm"
                    )
                
                res = await self._exec_sh(scaffold_cmd, timeout=self.INSTALL_TIMEOUT)
                if res["exit_code"] != 0:
                    return self.fail_response(f"Scaffold failed: {res['output']}")

                return self.success_response({
                    "message": f"Project '{project_name}' created successfully. Note: Optimized template not available - used manual creation.",
                    "project": project_name
                })

        except Exception as e:
            logger.error(f"Error creating web project: {e}", exc_info=True)
            return self.fail_response(f"Error creating web project: {e}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "install_dependencies",
            "description": "Install npm packages in a project using pnpm or npm.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_name": {"type": "string"},
                    "packages": {"type": "array", "items": {"type": "string"}},
                    "dev": {"type": "boolean", "default": False},
                    "package_manager": {"type": "string", "default": "pnpm"}
                },
                "required": ["project_name", "packages"]
            }
        }
    })
    @usage_example('''
        <!-- Install production dependencies in a project -->
        <function_calls>
        <invoke name="install_dependencies">
        <parameter name="project_name">my-app</parameter>
        <parameter name="packages">["axios", "react-query", "framer-motion"]</parameter>
        <parameter name="dev">false</parameter>
        <parameter name="package_manager">pnpm</parameter>
        </invoke>
        </function_calls>
        
        <!-- Install development dependencies -->
        <function_calls>
        <invoke name="install_dependencies">
        <parameter name="project_name">my-app</parameter>
        <parameter name="packages">["@types/node", "eslint", "prettier"]</parameter>
        <parameter name="dev">true</parameter>
        </invoke>
        </function_calls>
        ''')
    async def install_dependencies(self, project_name: str, packages: List[str], dev: bool = False, package_manager: str = "pnpm") -> ToolResult:
        try:
            await self._ensure_sandbox()
            
            if not await self._project_exists(project_name):
                return self.fail_response(f"Project '{project_name}' not found")

            proj_dir = self._get_project_path(project_name)
            pkg_list = " ".join(packages)
            
            command_type = "add_dev" if dev else "add"
            cmd = self._get_package_manager_command(package_manager, command_type, pkg_list)
            
            res = await self._exec_sh(f"cd {proj_dir} && {cmd}", timeout=self.INSTALL_TIMEOUT)
            
            if res["exit_code"] != 0:
                return self.fail_response(f"Package install failed: {res['output']}")
            
            return self.success_response(f"Installed packages in '{project_name}': {', '.join(packages)}")

        except Exception as e:
            logger.error(f"Error installing dependencies: {e}", exc_info=True)
            return self.fail_response(f"Error installing dependencies: {e}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "build_project",
            "description": "Run production build for the project.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_name": {"type": "string"},
                    "package_manager": {"type": "string", "default": "pnpm"}
                },
                "required": ["project_name"]
            }
        }
    })
    @usage_example('''
        <!-- Build a Next.js project for production -->
        <function_calls>
        <invoke name="build_project">
        <parameter name="project_name">my-app</parameter>
        <parameter name="package_manager">pnpm</parameter>
        </invoke>
        </function_calls>
        ''')
    async def build_project(self, project_name: str, package_manager: str = "pnpm") -> ToolResult:
        try:
            await self._ensure_sandbox()
            
            if not await self._project_exists(project_name):
                return self.fail_response(f"Project '{project_name}' not found")

            proj_dir = self._get_project_path(project_name)
            cmd = self._get_package_manager_command(package_manager, "build")
            
            res = await self._exec_sh(f"cd {proj_dir} && {cmd}", timeout=self.BUILD_TIMEOUT)
            
            if res["exit_code"] != 0:
                return self.fail_response(f"Build failed: {res['output']}")
            
            return self.success_response(f"Build completed for '{project_name}'.")

        except Exception as e:
            logger.error(f"Error building project: {e}", exc_info=True)
            return self.fail_response(f"Error building project: {e}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "start_server",
            "description": "Start a server for the project. mode='prod' runs next start after build; mode='dev' runs dev server. Returns exposed preview URL.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_name": {"type": "string"},
                    "mode": {"type": "string", "default": "prod", "description": "prod|dev"},
                    "port": {"type": "integer", "default": 3000},
                    "package_manager": {"type": "string", "default": "pnpm"}
                },
                "required": ["project_name"]
            }
        }
    })
    @usage_example('''
        <!-- Start a development server for testing -->
        <function_calls>
        <invoke name="start_server">
        <parameter name="project_name">my-app</parameter>
        <parameter name="mode">dev</parameter>
        <parameter name="port">3000</parameter>
        </invoke>
        </function_calls>
        
        <!-- Start a production server -->
        <function_calls>
        <invoke name="start_server">
        <parameter name="project_name">my-app</parameter>
        <parameter name="mode">prod</parameter>
        <parameter name="port">8080</parameter>
        <parameter name="package_manager">pnpm</parameter>
        </invoke>
        </function_calls>
        ''')
    async def start_server(self, project_name: str, mode: str = "prod", port: int = DEFAULT_PORT, package_manager: str = "pnpm") -> ToolResult:
        try:
            await self._ensure_sandbox()
            
            if not await self._project_exists(project_name):
                return self.fail_response(f"Project '{project_name}' not found")

            proj_dir = self._get_project_path(project_name)
            
            if mode == "prod":
                build_check = await self._exec_sh(f"test -d {proj_dir}/.next && echo BUILT || echo NOBUILD")
                if "NOBUILD" in build_check.get("output", ""):
                    build_cmd = self._get_package_manager_command(package_manager, "build")
                    build_res = await self._exec_sh(f"cd {proj_dir} && {build_cmd}", timeout=self.BUILD_TIMEOUT)
                    if build_res["exit_code"] != 0:
                        return self.fail_response(f"Build failed before start: {build_res['output']}")
                
                server_cmd = self._get_package_manager_command(package_manager, "start")
            else:
                server_cmd = self._get_package_manager_command(package_manager, "dev")

            cmd = f"cd {proj_dir} && PORT={port} {server_cmd}"
            session_name = f"web_{project_name}_{mode}"
            await self._run_in_tmux_background(session_name, cmd)

            link = await self.sandbox.get_preview_link(port)
            url = link.url if hasattr(link, 'url') else str(link)
            
            return self.success_response({
                "message": f"Started {mode} server for '{project_name}' on port {port}",
                "url": url,
                "port": port,
                "session": session_name
            })

        except Exception as e:
            logger.error(f"Error starting server: {e}", exc_info=True)
            return self.fail_response(f"Error starting server: {e}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "start_dev_server",
            "description": "Start a development server for the project (alias for start_server with mode=dev). Returns exposed preview URL.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_name": {"type": "string"},
                    "port": {"type": "integer", "default": 3000},
                    "package_manager": {"type": "string", "default": "pnpm"}
                },
                "required": ["project_name"]
            }
        }
    })
    @usage_example('''
        <!-- Quickly start a development server with hot reloading -->
        <function_calls>
        <invoke name="start_dev_server">
        <parameter name="project_name">my-app</parameter>
        </invoke>
        </function_calls>
        
        <!-- Start dev server on a custom port -->
        <function_calls>
        <invoke name="start_dev_server">
        <parameter name="project_name">my-app</parameter>
        <parameter name="port">4000</parameter>
        <parameter name="package_manager">npm</parameter>
        </invoke>
        </function_calls>
        ''')
    async def start_dev_server(self, project_name: str, port: int = DEFAULT_PORT, package_manager: str = "pnpm") -> ToolResult:
        return await self.start_server(
            project_name=project_name, 
            mode="dev", 
            port=port, 
            package_manager=package_manager
        ) 