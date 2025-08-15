'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Save, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUpdateAgent } from '@/hooks/react-query/agents/use-agents';
import { useCreateAgentVersion, useActivateAgentVersion } from '@/hooks/react-query/agents/use-agent-versions';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AgentPreview } from '../../../../../components/agents/agent-preview';

import { useAgentVersionData } from '../../../../../hooks/use-agent-version-data';
import { useSearchParams } from 'next/navigation';
import { useAgentVersionStore } from '../../../../../lib/stores/agent-version-store';

import { cn } from '@/lib/utils';

import { AgentHeader, VersionAlert, AgentBuilderTab, ConfigurationTab } from '@/components/agents/config';

import { DEFAULT_AGENTPRESS_TOOLS } from '@/components/agents/tools';
import { useExportAgent } from '@/hooks/react-query/agents/use-agent-export-import';

interface FormData {
  name: string;
  description: string;
  system_prompt: string;
  model?: string;
  agentpress_tools: any;
  configured_mcps: any[];
  custom_mcps: any[];
  is_default: boolean;
  profile_image_url?: string;
}

export default function AgentConfigurationPage() {
  const params = useParams();
  const agentId = params.agentId as string;
  const queryClient = useQueryClient();

  const { agent, versionData, isViewingOldVersion, isLoading, error } = useAgentVersionData({ agentId });
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialAccordion = searchParams.get('accordion');
  const versionParam = searchParams.get('version');  // Add this line
  const { setHasUnsavedChanges } = useAgentVersionStore();
  
  const updateAgentMutation = useUpdateAgent();
  const createVersionMutation = useCreateAgentVersion();
  const activateVersionMutation = useActivateAgentVersion();
  const exportMutation = useExportAgent();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    system_prompt: '',
    model: undefined,
    agentpress_tools: DEFAULT_AGENTPRESS_TOOLS,
    configured_mcps: [],
    custom_mcps: [],
    is_default: false,
    profile_image_url: '',
  });

  const [originalData, setOriginalData] = useState<FormData>(formData);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  // Default to 'agent-builder' (Prompt to build) tab unless explicitly set to 'configuration'
  const initialTab = tabParam === 'configuration' ? 'configuration' : 'agent-builder';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Log the default tab selection for debugging
  console.log('🔄 Default tab selected:', initialTab, 'from URL param:', tabParam);

  useEffect(() => {
    if (!agent) return;
    
    let configSource = agent;
    if (versionData) {
      configSource = versionData;
    } 
    else if (agent.current_version) {
      configSource = agent.current_version;
    }
    
    const initialData: FormData = {
      name: agent.name || '',
      description: agent.description || '',
      system_prompt: configSource.system_prompt || '',
      model: configSource.model || undefined, // Initialize model
      agentpress_tools: configSource.agentpress_tools || DEFAULT_AGENTPRESS_TOOLS,
      configured_mcps: configSource.configured_mcps || [],
      custom_mcps: configSource.custom_mcps || [],
      is_default: agent.is_default || false,
      profile_image_url: agent.profile_image_url || '',
    };
    
    setFormData(initialData);
    setOriginalData(initialData);
  }, [agent, versionData]);

  // Save handler for manual saves
  const [isSaving, setIsSaving] = useState(false);
  
  const handleSave = useCallback(async () => {
    if (!agent || isViewingOldVersion || isSaving) return;
    
    const isSunaAgent = agent?.metadata?.is_suna_default || false;
    const restrictions = agent?.metadata?.restrictions || {};
    
    if (isSunaAgent) {
      if (restrictions.name_editable === false && formData.name !== originalData.name) {
        toast.error("Suna's name cannot be modified.");
        return;
      }

      if (restrictions.tools_editable === false && JSON.stringify(formData.agentpress_tools) !== JSON.stringify(originalData.agentpress_tools)) {
        toast.error("Suna's default tools cannot be modified.");
        return;
      }
    }
    
    const normalizedCustomMcps = (formData.custom_mcps || []).map(mcp => ({
      name: mcp.name || 'Unnamed MCP',
      type: mcp.type || mcp.customType || 'sse',
      config: mcp.config || {},
      enabledTools: Array.isArray(mcp.enabledTools) ? mcp.enabledTools : [],
    }));
    
    setIsSaving(true);
    
    try {
      // Create new version and update agent
      await Promise.all([
        createVersionMutation.mutateAsync({
          agentId,
          data: {
            system_prompt: isSunaAgent ? '' : formData.system_prompt,
            model: formData.model,  // Include model in save
            configured_mcps: formData.configured_mcps,
            custom_mcps: normalizedCustomMcps,
            agentpress_tools: formData.agentpress_tools,
            description: 'Manual save'
          }
        }),
        updateAgentMutation.mutateAsync({
          agentId,
          name: formData.name,
          description: formData.description,
          is_default: formData.is_default,
          profile_image_url: formData.profile_image_url || undefined,
        })
      ]);
      
      // The createVersionMutation already handles query invalidation
      
      toast.success('Agent saved successfully');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save agent');
    } finally {
      setIsSaving(false);
    }
  }, [agent, formData, originalData, isViewingOldVersion, agentId, createVersionMutation, updateAgentMutation, isSaving, queryClient]);

  // Check for unsaved changes
  const hasUnsavedChanges = JSON.stringify(formData) !== JSON.stringify(originalData);
  
  useEffect(() => {
    setHasUnsavedChanges(hasUnsavedChanges);
  }, [hasUnsavedChanges, setHasUnsavedChanges]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasUnsavedChanges && !isViewingOldVersion && !isSaving) {
          handleSave();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, isViewingOldVersion, isSaving, handleSave]);

  const handleFieldChange = useCallback((field: keyof FormData, value: any) => {
    if (isViewingOldVersion) {
      toast.error('Cannot edit old versions. Please activate this version first to make changes.');
      return;
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  }, [isViewingOldVersion]);

  // Dedicated name save handler that saves immediately
  const handleNameSave = useCallback(async (name: string) => {
    if (!agent || isViewingOldVersion || isSaving) {
      return;
    }
    
    const isSunaAgent = agent?.metadata?.is_suna_default || false;
    const restrictions = agent?.metadata?.restrictions || {};
    
    if (isSunaAgent && restrictions.name_editable === false) {
      toast.error("Name cannot be edited", {
        description: "Suna's name is managed centrally and cannot be changed.",
      });
      return;
    }
    
    // Update form data immediately
    setFormData(prev => ({ ...prev, name }));
    
    setIsSaving(true);
    
    try {
      await updateAgentMutation.mutateAsync({
        agentId,
        name,
        description: formData.description,
        is_default: formData.is_default,
        profile_image_url: formData.profile_image_url || undefined,
      });
      
      // Update original data to reflect the save
      setOriginalData(prev => ({ ...prev, name }));
      toast.success('Agent name saved');
    } catch (error) {
      console.error('❌ Name save error:', error);
      toast.error('Failed to save agent name');
      // Revert the name change on error
      setFormData(prev => ({ ...prev, name: formData.name }));
    } finally {
      setIsSaving(false);
    }
  }, [isViewingOldVersion, formData, agent, agentId, updateAgentMutation, isSaving]);

  const handleSystemPromptSave = useCallback(async (value: string) => {
    if (!agent || isViewingOldVersion || isSaving) {
      return;
    }
    
    const isSunaAgent = agent?.metadata?.is_suna_default || false;
    
    if (isSunaAgent) {
      toast.error("System prompt cannot be edited", {
        description: "Suna's system prompt is managed centrally and cannot be changed.",
      });
      return;
    }
    
    setFormData(prev => ({ ...prev, system_prompt: value }));
    
    const normalizedCustomMcps = (formData.custom_mcps || []).map(mcp => ({
      name: mcp.name || 'Unnamed MCP',
      type: mcp.type || mcp.customType || 'sse',
      config: mcp.config || {},
      enabledTools: Array.isArray(mcp.enabledTools) ? mcp.enabledTools : [],
    }));
    
    const saveData = {
      system_prompt: value,
      model: formData.model,
      configured_mcps: formData.configured_mcps,
      custom_mcps: normalizedCustomMcps,
      agentpress_tools: formData.agentpress_tools,
      description: 'System prompt update'
    };
    
    setIsSaving(true);
    
    try {
      const result = await createVersionMutation.mutateAsync({
        agentId,
        data: saveData
      });
      
      setOriginalData(prev => ({ ...prev, system_prompt: value }));
      toast.success('System prompt saved');
      
      // The createVersionMutation already handles query invalidation
    } catch (error) {
      console.error('❌ Save error:', error);
      toast.error('Failed to save system prompt');
    } finally {
      setIsSaving(false);
    }
  }, [isViewingOldVersion, formData, agent, agentId, createVersionMutation, isSaving, originalData]);

  const handleProfileImageSave = useCallback(async (profileImageUrl: string | null) => {
    if (!agent || isViewingOldVersion || isSaving) {
      return;
    }
    
    setFormData(prev => ({ ...prev, profile_image_url: profileImageUrl || '' }));
    
    setIsSaving(true);
    
    try {
      await updateAgentMutation.mutateAsync({
        agentId,
        name: formData.name,
        description: formData.description,
        is_default: formData.is_default,
        profile_image_url: profileImageUrl || undefined,
      });
      
      setOriginalData(prev => ({ ...prev, profile_image_url: profileImageUrl || '' }));
      toast.success('Profile image saved');
    } catch (error) {
      console.error('❌ Profile image save error:', error);
      toast.error('Failed to save profile image');
      setFormData(prev => ({ ...prev, profile_image_url: originalData.profile_image_url }));
    } finally {
      setIsSaving(false);
    }
  }, [isViewingOldVersion, formData, agent, agentId, updateAgentMutation, isSaving, originalData]);

  const handleModelSave = useCallback(async (model: string) => {
    if (!agent || isViewingOldVersion || isSaving) {
      return;
    }
    
    setFormData(prev => ({ ...prev, model }));
    
    const normalizedCustomMcps = (formData.custom_mcps || []).map(mcp => ({
      name: mcp.name || 'Unnamed MCP',
      type: mcp.type || mcp.customType || 'sse',
      config: mcp.config || {},
      enabledTools: Array.isArray(mcp.enabledTools) ? mcp.enabledTools : [],
    }));
    
    const isSunaAgent = agent?.metadata?.is_suna_default || false;
    
    const saveData = {
      system_prompt: isSunaAgent ? '' : formData.system_prompt,
      model,
      configured_mcps: formData.configured_mcps,
      custom_mcps: normalizedCustomMcps,
      agentpress_tools: formData.agentpress_tools,
      description: 'Model update'
    };

    setIsSaving(true);
    
    try {
      const result = await createVersionMutation.mutateAsync({
        agentId,
        data: saveData
      });
      
      toast.success('Model configuration saved');
      
      // The createVersionMutation already handles query invalidation
    } catch (error) {
      toast.error('Failed to save model configuration');
      setFormData(prev => ({ ...prev, model: originalData.model }));
    } finally {
      setIsSaving(false);
    }
  }, [isViewingOldVersion, formData, agent, agentId, createVersionMutation, isSaving, originalData]);

  const handleToolsSave = useCallback(async (tools: Record<string, boolean | { enabled: boolean; description: string }>) => {
    if (!agent || isViewingOldVersion || isSaving) {
      return;
    }
    
    const isSunaAgent = agent?.metadata?.is_suna_default || false;
    const restrictions = agent?.metadata?.restrictions || {};
    
    if (isSunaAgent && restrictions.tools_editable === false) {
      toast.error("Suna's default tools cannot be modified.");
      return;
    }
    
    setFormData(prev => ({ ...prev, agentpress_tools: tools }));
    
    const normalizedCustomMcps = (formData.custom_mcps || []).map(mcp => ({
      name: mcp.name || 'Unnamed MCP',
      type: mcp.type || mcp.customType || 'sse',
      config: mcp.config || {},
      enabledTools: Array.isArray(mcp.enabledTools) ? mcp.enabledTools : [],
    }));
    
    const saveData = {
      system_prompt: isSunaAgent ? '' : formData.system_prompt,
      model: formData.model,
      configured_mcps: formData.configured_mcps,
      custom_mcps: normalizedCustomMcps,
      agentpress_tools: tools,
      description: 'Tools configuration update'
    };
    
    setIsSaving(true);
    
    try {
      const result = await createVersionMutation.mutateAsync({
        agentId,
        data: saveData
      });
      setOriginalData(prev => ({ ...prev, agentpress_tools: tools }));
      toast.success('Tools configuration saved');
      
      // The createVersionMutation already handles query invalidation
    } catch (error) {
      console.error('❌ Tools save error:', error);
      toast.error('Failed to save tools configuration');
    } finally {
      setIsSaving(false);
    }
  }, [isViewingOldVersion, formData, agent, agentId, createVersionMutation, isSaving, originalData]);

  const handleMCPChange = useCallback(async (updates: { configured_mcps: any[]; custom_mcps: any[] }) => {
    if (isViewingOldVersion) {
      toast.error('Cannot edit old versions. Please activate this version first to make changes.');
      return;
    }
    
    const newFormData = {
      ...formData,
      configured_mcps: updates.configured_mcps,
      custom_mcps: updates.custom_mcps
    };
    
    setFormData(newFormData);
    if (!agent || isViewingOldVersion || isSaving) return;
    
    const normalizedCustomMcps = (newFormData.custom_mcps || []).map(mcp => ({
      name: mcp.name || 'Unnamed MCP',
      type: mcp.type || mcp.customType || 'sse',
      config: mcp.config || {},
      enabledTools: Array.isArray(mcp.enabledTools) ? mcp.enabledTools : [],
    }));
    
    setIsSaving(true);
    
    try {
      const result = await createVersionMutation.mutateAsync({
        agentId,
        data: {
          system_prompt: agent?.metadata?.is_suna_default ? '' : newFormData.system_prompt,
          model: newFormData.model, 
          configured_mcps: newFormData.configured_mcps,
          custom_mcps: normalizedCustomMcps,
          agentpress_tools: newFormData.agentpress_tools,
          description: 'Integration change'
        }
      });
      
      setOriginalData(newFormData);
      toast.success('Integration saved');
      
      // The createVersionMutation already handles query invalidation
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save integration');
    } finally {
      setIsSaving(false);
    }
  }, [isViewingOldVersion, formData, agent, agentId, createVersionMutation, isSaving]);


  const handleActivateVersion = useCallback(async (versionId: string) => {
    try {
      await activateVersionMutation.mutateAsync({ agentId, versionId });
    } catch (error) {
      toast.error('Failed to activate version');
    }
  }, [agentId, activateVersionMutation]);

  const handleExport = useCallback(() => {
    if (!agentId) return;
    exportMutation.mutate(agentId);
  }, [agentId, exportMutation]);

  useEffect(() => {
    if (isViewingOldVersion && activeTab === 'agent-builder') {
      setActiveTab('configuration');
    }
  }, [isViewingOldVersion, activeTab]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>
            {error.message || 'Failed to load agent configuration'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Only show loading state on initial load, not on refetches
  if (isLoading && !agent) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading agent configuration...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Alert className="max-w-md">
          <AlertDescription>Agent not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const displayData = isViewingOldVersion && versionData ? {
    name: agent?.name || '',
    description: agent?.description || '',
    system_prompt: versionData.system_prompt || '',
    model: versionData.model,
    agentpress_tools: versionData.agentpress_tools || DEFAULT_AGENTPRESS_TOOLS,
    configured_mcps: versionData.configured_mcps || [],
    custom_mcps: versionData.custom_mcps || [],
    is_default: agent?.is_default || false,
    profile_image_url: agent?.profile_image_url || '',
  } : formData;


  const previewAgent = {
    ...agent,
    ...displayData,
    agent_id: agentId,
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="flex-1 flex overflow-hidden">
        <div className="hidden lg:grid lg:grid-cols-2 w-full h-full">
          <div className="bg-background h-full flex flex-col border-r border-border/40 overflow-hidden">
            <div className="flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="pt-4">

                
                {isViewingOldVersion && (
                  <div className="mb-4 px-8">
                    <VersionAlert
                      versionData={versionData}
                      isActivating={activateVersionMutation.isPending}
                      onActivateVersion={handleActivateVersion}
                    />
                  </div>
                )}
                
                <AgentHeader
                  agentId={agentId}
                  displayData={displayData}
                  activeTab={activeTab}
                  isViewingOldVersion={isViewingOldVersion}
                  onFieldChange={handleFieldChange}
                  onTabChange={setActiveTab}
                  onExport={handleExport}
                  isExporting={exportMutation.isPending}
                  agentMetadata={agent?.metadata}
                  currentVersionId={agent?.current_version_id}
                  currentFormData={{
                    system_prompt: formData.system_prompt,
                    configured_mcps: formData.configured_mcps,
                    custom_mcps: formData.custom_mcps,
                    agentpress_tools: formData.agentpress_tools
                  }}
                  hasUnsavedChanges={hasUnsavedChanges}
                  onVersionCreated={() => {
                    setOriginalData(formData);
                  }}
                  onNameSave={handleNameSave}
                  onProfileImageSave={handleProfileImageSave}
                />
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {agent?.metadata?.is_suna_default ? (
                <ConfigurationTab
                  agentId={agentId}
                  displayData={displayData}
                  versionData={versionData}
                  isViewingOldVersion={isViewingOldVersion}
                  onFieldChange={handleFieldChange}
                  onMCPChange={handleMCPChange}
                  onSystemPromptSave={handleSystemPromptSave}
                  onModelSave={handleModelSave}
                  onToolsSave={handleToolsSave}
                  initialAccordion={initialAccordion}
                  agentMetadata={agent?.metadata}
                  isLoading={isSaving}
                />
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
                  <TabsContent value="agent-builder" className="flex-1 m-0 overflow-hidden">
                    <AgentBuilderTab
                      agentId={agentId}
                      displayData={displayData}
                          isViewingOldVersion={isViewingOldVersion}
                      onFieldChange={handleFieldChange}
                        />
                  </TabsContent>
                  <TabsContent value="configuration" className="flex-1 m-0 overflow-hidden">
                    <ConfigurationTab
                      agentId={agentId}
                      displayData={displayData}
                      versionData={versionData}
                      isViewingOldVersion={isViewingOldVersion}
                      onFieldChange={handleFieldChange}
                      onMCPChange={handleMCPChange}
                      onSystemPromptSave={handleSystemPromptSave}
                      onModelSave={handleModelSave}
                      onToolsSave={handleToolsSave}
                      initialAccordion={initialAccordion}
                      agentMetadata={agent?.metadata}
                    />
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>
          <div className="bg-muted/30 h-full overflow-hidden">
            <div className="h-full overflow-y-auto">
              {previewAgent && <AgentPreview agent={previewAgent} agentMetadata={agent?.metadata} />}
            </div>
          </div>
        </div>
        <div className="lg:hidden flex flex-col h-full w-full">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="py-2">

                {isViewingOldVersion && (
                  <div className="mb-4 px-8">
                    <VersionAlert
                      versionData={versionData}
                      isActivating={activateVersionMutation.isPending}
                      onActivateVersion={handleActivateVersion}
                    />
                  </div>
                )}
                <AgentHeader
                  agentId={agentId}
                  displayData={displayData}
                  activeTab={activeTab}
                  isViewingOldVersion={isViewingOldVersion}
                  onFieldChange={handleFieldChange}
                  onTabChange={setActiveTab}
                  onExport={handleExport}
                  isExporting={exportMutation.isPending}
                  agentMetadata={agent?.metadata}
                  currentVersionId={agent?.current_version_id}
                  currentFormData={{
                    system_prompt: formData.system_prompt,
                    configured_mcps: formData.configured_mcps,
                    custom_mcps: formData.custom_mcps,
                    agentpress_tools: formData.agentpress_tools
                  }}
                  hasUnsavedChanges={hasUnsavedChanges}
                  onVersionCreated={() => {
                    setOriginalData(formData);
                  }}
                  onNameSave={handleNameSave}
                  onProfileImageSave={handleProfileImageSave}
                />
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {agent?.metadata?.is_suna_default ? (
                <ConfigurationTab
                  agentId={agentId}
                  displayData={displayData}
                  versionData={versionData}
                  isViewingOldVersion={isViewingOldVersion}
                  onFieldChange={handleFieldChange}
                  onMCPChange={handleMCPChange}
                  onSystemPromptSave={handleSystemPromptSave}
                  onModelSave={handleModelSave}
                  onToolsSave={handleToolsSave}
                  initialAccordion={initialAccordion}
                  agentMetadata={agent?.metadata}
                  isLoading={isSaving}
                />
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
                  <TabsContent value="agent-builder" className="flex-1 m-0 overflow-hidden">
                    <AgentBuilderTab
                      agentId={agentId}
                      displayData={displayData}
                          isViewingOldVersion={isViewingOldVersion}
                      onFieldChange={handleFieldChange}
                        />
                  </TabsContent>
                  <TabsContent value="configuration" className="flex-1 m-0 overflow-hidden">
                    <ConfigurationTab
                      agentId={agentId}
                      displayData={displayData}
                      versionData={versionData}
                      isViewingOldVersion={isViewingOldVersion}
                      onFieldChange={handleFieldChange}
                      onMCPChange={handleMCPChange}
                      onSystemPromptSave={handleSystemPromptSave}
                      onModelSave={handleModelSave}
                      onToolsSave={handleToolsSave}
                      initialAccordion={initialAccordion}
                      agentMetadata={agent?.metadata}
                    />
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </div>
          <Drawer open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DrawerTrigger asChild>
              <Button 
                className="fixed bottom-6 right-6 rounded-full shadow-lg h-14 w-14 bg-primary hover:bg-primary/90 z-50"
                size="icon"
              >
                <Eye className="h-5 w-5" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="h-[85vh]">
              <DrawerHeader className="border-b">
                <DrawerTitle>Agent Preview</DrawerTitle>
              </DrawerHeader>
              <div className="flex-1 overflow-y-auto p-4">
                {previewAgent && <AgentPreview agent={previewAgent} agentMetadata={agent?.metadata} />}
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    </div>
  );
} 