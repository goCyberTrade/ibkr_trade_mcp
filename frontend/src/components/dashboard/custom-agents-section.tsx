'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Ripple } from '../ui/ripple';
import { useKortixTeamTemplates, useInstallTemplate } from '@/hooks/react-query/secure-mcp/use-secure-mcp';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { MarketplaceAgentPreviewDialog } from '@/components/agents/marketplace-agent-preview-dialog';
import { StreamlinedInstallDialog } from '@/components/agents/installation/streamlined-install-dialog';
import { toast } from 'sonner';
import { AgentCountLimitDialog } from '@/components/agents/agent-count-limit-dialog';
import type { MarketplaceTemplate } from '@/components/agents/installation/types';
import { AgentCountLimitError } from '@/lib/api';

interface CustomAgentsSectionProps {
  onAgentSelect?: (templateId: string) => void;
}

export function CustomAgentsSection({ onAgentSelect }: CustomAgentsSectionProps) {
  const router = useRouter();
  const { data: templates, isLoading, error } = useKortixTeamTemplates();
  const installTemplate = useInstallTemplate();
  
  const [selectedTemplate, setSelectedTemplate] = React.useState<MarketplaceTemplate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [showInstallDialog, setShowInstallDialog] = React.useState(false);
  const [showAgentLimitDialog, setShowAgentLimitDialog] = React.useState(false);
  const [agentLimitError, setAgentLimitError] = React.useState<any>(null);
  const [installingItemId, setInstallingItemId] = React.useState<string | null>(null);

  const handleCardClick = (template: any) => {
    // Map the template to MarketplaceTemplate format
    const marketplaceTemplate: MarketplaceTemplate = {
      id: template.template_id,
      template_id: template.template_id,
      creator_id: template.creator_id,
      name: template.name,
      description: template.description,
      tags: template.tags || [],
      download_count: template.download_count || 0,
      is_kortix_team: template.is_kortix_team || false,
      creator_name: template.creator_name,
      created_at: template.created_at,
      profile_image_url: template.profile_image_url,
      avatar: template.avatar,
      avatar_color: template.avatar_color,
      mcp_requirements: template.mcp_requirements || [],
      agentpress_tools: template.agentpress_tools || {},
      model: template.metadata?.model,
      marketplace_published_at: template.marketplace_published_at,
    };
    
    setSelectedTemplate(marketplaceTemplate);
    setIsPreviewOpen(true);
  };

  // Handle clicking Install from the preview dialog - opens the streamlined install dialog
  const handlePreviewInstall = (agent: MarketplaceTemplate) => {
    setIsPreviewOpen(false);
    setSelectedTemplate(agent);
    setShowInstallDialog(true);
  };

  // Handle the actual installation from the streamlined dialog
  const handleInstall = async (
    item: MarketplaceTemplate, 
    instanceName: string, 
    profileMappings: Record<string, string>, 
    customServerConfigs: Record<string, any>
  ) => {
    if (!item) return;

    setInstallingItemId(item.id);

    try {
      const result = await installTemplate.mutateAsync({
        template_id: item.id,
        instance_name: instanceName,
        profile_mappings: profileMappings,
        custom_mcp_configs: customServerConfigs,
      });

      if (result.status === 'installed' && result.instance_id) {
        toast.success(`Agent "${instanceName}" installed successfully!`);
        setShowInstallDialog(false);
        router.push(`/agents/config/${result.instance_id}`);
      } else if (result.status === 'configs_required') {
        toast.error('Please provide all required configurations');
        return;
      } else {
        toast.error('Unexpected response from server. Please try again.');
        return;
      }
    } catch (error: any) {
      console.error('Installation error:', error);

      if (error instanceof AgentCountLimitError) {
        setAgentLimitError(error.detail);
        setShowAgentLimitDialog(true);
        setShowInstallDialog(false);
        return;
      }

      if (error.message?.includes('already in your library')) {
        toast.error('This agent is already in your library');
      } else if (error.message?.includes('Credential profile not found')) {
        toast.error('One or more selected credential profiles could not be found. Please refresh and try again.');
      } else if (error.message?.includes('Missing credential profile')) {
        toast.error('Please select credential profiles for all required services');
      } else if (error.message?.includes('Invalid credential profile')) {
        toast.error('One or more selected credential profiles are invalid. Please select valid profiles.');
      } else if (error.message?.includes('inactive')) {
        toast.error('One or more selected credential profiles are inactive. Please select active profiles.');
      } else if (error.message?.includes('Template not found')) {
        toast.error('This agent template is no longer available');
      } else if (error.message?.includes('Access denied')) {
        toast.error('You do not have permission to install this agent');
      } else {
        toast.error(error.message || 'Failed to install agent. Please try again.');
      }
    } finally {
      setInstallingItemId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="relative col-span-1 sm:col-span-2 lg:col-span-2 overflow-hidden rounded-3xl flex items-center justify-center border bg-background">
            <div className="relative px-8 py-16 text-start">
              <div className="mx-auto max-w-3xl space-y-6">
                <h2 className="text-4xl font-semibold text-foreground mb-2">
                  Custom Agents
                </h2>
                <p className="text-muted-foreground text-sm">
                  Specialized AI agents built by the Kortix team for specific tasks
                </p>
              </div>
            </div>
            <Ripple/>
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-muted/30 rounded-3xl p-6 min-h-[280px]">
              <Skeleton className="h-14 w-14 rounded-2xl mb-4" />
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-12 w-full mb-4" />
              <Skeleton className="h-9 w-full mt-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Failed to load custom agents</p>
        </div>
      </div>
    );
  }

  // No agents found
  if (!templates || templates.length === 0) {
    return (
      <div className="w-full max-w-6xl mx-auto px-4">
        <div className="text-center py-8">
          <p className="text-muted-foreground">No custom agents available yet</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-4xl mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="max-h-[180px] relative col-span-1 overflow-hidden rounded-3xl flex items-center justify-center border bg-background">
            <div className="relative px-8 py-16 text-start">
              <div className="mx-auto max-w-3xl space-y-6">
                <h2 className="text-3xl font-semibold text-foreground mb-2">
                  Featured Agents
                </h2>
                <p className="text-muted-foreground text-sm">
                  Specialized AI agents built by the Kortix team for specific tasks
                </p>
              </div>
            </div>
            <Ripple/>
          </div>
          {templates.slice(0, 6).map((template) => (
            <div
              key={template.template_id}
              className={cn(
                'group relative bg-muted/30 rounded-3xl overflow-hidden transition-all duration-300 border cursor-pointer flex flex-col max-h-[180px] border-border/50',
                'hover:border-primary/20'
              )}
              onClick={() => handleCardClick(template)}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="h-full relative flex overflow-hidden w-full">
                <div className="flex items-center justify-center p-4">
                  {template.profile_image_url ? (
                    <img 
                      src={template.profile_image_url}
                      alt={template.name}
                      className="h-full w-auto object-cover rounded-2xl"
                    />
                  ) : (
                    <div 
                      className="relative h-14 w-14 flex items-center justify-center rounded-2xl text-2xl shadow-md flex-shrink-0"
                      style={{ 
                        backgroundColor: template.avatar_color || '#3b82f6',
                      }}
                    >
                      <span>{template.avatar || '🤖'}</span>
                      <div
                        className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 dark:opacity-100 transition-opacity"
                        style={{
                          boxShadow: `0 16px 48px -8px ${template.avatar_color || '#3b82f6'}70, 0 8px 24px -4px ${template.avatar_color || '#3b82f6'}50`
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className='flex-1 flex flex-col justify-center p-4 pr-6'>
                  <h3 className="text-lg font-semibold text-foreground line-clamp-1">
                    {template.name}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem] leading-relaxed">
                    {template.description || 'No description available'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Marketplace Preview Dialog */}
      <MarketplaceAgentPreviewDialog
        agent={selectedTemplate}
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setSelectedTemplate(null);
        }}
        onInstall={handlePreviewInstall}
        isInstalling={installingItemId === selectedTemplate?.id}
      />

      {/* Streamlined Install Dialog */}
      <StreamlinedInstallDialog
        item={selectedTemplate}
        open={showInstallDialog}
        onOpenChange={setShowInstallDialog}
        onInstall={handleInstall}
        isInstalling={installingItemId === selectedTemplate?.id}
      />

      {/* Agent Limit Dialog */}
      {showAgentLimitDialog && agentLimitError && (
        <AgentCountLimitDialog
          open={showAgentLimitDialog}
          onOpenChange={setShowAgentLimitDialog}
          currentCount={agentLimitError.current_count}
          limit={agentLimitError.limit}
          tierName={agentLimitError.tier_name}
        />
      )}
    </>
  );
} 