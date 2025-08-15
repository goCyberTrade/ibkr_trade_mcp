'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Cpu, Search, Check, ChevronDown, Plus, ExternalLink, Crown } from 'lucide-react';
import { useAgents } from '@/hooks/react-query/agents/use-agents';
import { KortixLogo } from '@/components/sidebar/kortix-logo';
import type { ModelOption, SubscriptionStatus } from './_use-model-selection';
import { MODELS, STORAGE_KEY_CUSTOM_MODELS, STORAGE_KEY_MODEL, formatModelName, getCustomModels } from './_use-model-selection';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { isLocalMode } from '@/lib/config';
import { CustomModelDialog, type CustomModelFormData } from './custom-model-dialog';
import { IntegrationsRegistry } from '@/components/agents/integrations-registry';
import { useComposioToolkitIcon } from '@/hooks/react-query/composio/use-composio';
import { Skeleton } from '@/components/ui/skeleton';
import { NewAgentDialog } from '@/components/agents/new-agent-dialog';
import { useAgentWorkflows } from '@/hooks/react-query/agents/use-agent-workflows';
import { PlaybookExecuteDialog } from '@/components/playbooks/playbook-execute-dialog';
import { AgentAvatar } from '@/components/thread/content/agent-avatar';

type UnifiedConfigMenuProps = {
    isLoggedIn?: boolean;

    // Agent
    selectedAgentId?: string;
    onAgentSelect?: (agentId: string | undefined) => void;

    // Model
    selectedModel: string;
    onModelChange: (modelId: string) => void;
    modelOptions: ModelOption[];
    subscriptionStatus: SubscriptionStatus;
    canAccessModel: (modelId: string) => boolean;
    refreshCustomModels?: () => void;
    onUpgradeRequest?: () => void;
};

const LoggedInMenu: React.FC<UnifiedConfigMenuProps> = ({
    isLoggedIn = true,
    selectedAgentId,
    onAgentSelect,
    selectedModel,
    onModelChange,
    modelOptions,
    canAccessModel,
    subscriptionStatus,
    onUpgradeRequest,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const [integrationsOpen, setIntegrationsOpen] = useState(false);
    const [showNewAgentDialog, setShowNewAgentDialog] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [execDialog, setExecDialog] = useState<{ open: boolean; playbook: any | null; agentId: string | null }>({ open: false, playbook: null, agentId: null });
    const [isCustomModelDialogOpen, setIsCustomModelDialogOpen] = useState(false);
    const [dialogInitialData, setDialogInitialData] = useState<CustomModelFormData>({ id: '', label: '' });
    const [customModels, setCustomModels] = useState<Array<{ id: string; label: string }>>([]);

    const { data: agentsResponse } = useAgents({}, { enabled: isLoggedIn });
    const agents: any[] = agentsResponse?.agents || [];



    // Only fetch integration icons when authenticated AND the menu is open
    const iconsEnabled = isLoggedIn && isOpen;
    const { data: googleDriveIcon } = useComposioToolkitIcon('googledrive', { enabled: iconsEnabled });
    const { data: slackIcon } = useComposioToolkitIcon('slack', { enabled: iconsEnabled });
    const { data: notionIcon } = useComposioToolkitIcon('notion', { enabled: iconsEnabled });

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => searchInputRef.current?.focus(), 30);
        } else {
            setSearchQuery('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (isLocalMode()) {
            setCustomModels(getCustomModels());
        }
    }, []);

    // Keep focus stable even when list size changes
    useEffect(() => {
        if (isOpen) searchInputRef.current?.focus();
    }, [searchQuery, isOpen]);

    const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Prevent Radix dropdown from stealing focus/navigation
        e.stopPropagation();
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
        }
    };

    // Filtered agents with selected first
    const filteredAgents = useMemo(() => {
        const list = [...agents];
        const selected = selectedAgentId ? list.find(a => a.agent_id === selectedAgentId) : undefined;
        const rest = selected ? list.filter(a => a.agent_id !== selectedAgentId) : list;
        const ordered = selected ? [selected, ...rest] : rest;
        return ordered.filter(a => (
            a?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a?.description?.toLowerCase().includes(searchQuery.toLowerCase())
        ));
    }, [agents, selectedAgentId, searchQuery]);

    // Top 3 slice
    const topAgents = useMemo(() => filteredAgents.slice(0, 3), [filteredAgents]);

    // Build combined model list early (needed for displayTopModels)
    const combinedModels: ModelOption[] = useMemo(() => {
        if (!isLocalMode()) return modelOptions;
        const baseIds = new Set(modelOptions.map(m => m.id));
        const customs: ModelOption[] = customModels
            .filter(cm => !baseIds.has(cm.id))
            .map(cm => ({ id: cm.id, label: cm.label || formatModelName(cm.id), requiresSubscription: false, top: false }));
        return [...modelOptions, ...customs];
    }, [modelOptions, customModels]);

    // Compute top models (max 3)
    const topModels = useMemo(() => {
        const base = modelOptions.filter(m => m.top === true);
        const filtered = base.filter(m =>
            m.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.id.toLowerCase().includes(searchQuery.toLowerCase())
        );
        const isFree = !isLocalMode() && subscriptionStatus === 'no_subscription';
        const accessibleFirst = isFree
            ? filtered.filter(m => canAccessModel(m.id))
            : filtered;
        return accessibleFirst.slice(0, 3);
    }, [modelOptions, searchQuery, subscriptionStatus, canAccessModel]);

    const displayTopModels = useMemo(() => {
        // We reference combinedModels below, so guard by computing source first
        const source = isLocalMode() ? (typeof combinedModels !== 'undefined' ? combinedModels : modelOptions) : modelOptions;
        const selectedInAll = source.find(o => o.id === selectedModel);
        if (!selectedInAll) return topModels;
        const already = topModels.some(m => m.id === selectedModel);
        if (already) return topModels;
        const merged = [...topModels, selectedInAll];
        return merged.slice(0, 4);
    }, [topModels, selectedModel, modelOptions, /* combinedModels is computed later but stable across re-renders */]);

    const handleAgentClick = (agentId: string | undefined) => {
        onAgentSelect?.(agentId);
        setIsOpen(false);
    };

    const handleModelClick = (modelId: string) => {
        if (!canAccessModel(modelId)) return; // keep compact, no paywall here
        onModelChange(modelId);
        setIsOpen(false);
    };

    const handleUpgradeClick = () => {
        if (onUpgradeRequest) {
            onUpgradeRequest();
            return;
        }
        if (typeof window !== 'undefined') {
            window.open('/dashboard/settings/billing', '_blank');
        }
    };

    const openAddCustomModelDialog = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setDialogInitialData({ id: '', label: '' });
        setIsCustomModelDialogOpen(true);
        setIsOpen(false);
    };

    const closeCustomModelDialog = () => {
        setIsCustomModelDialogOpen(false);
        setDialogInitialData({ id: '', label: '' });
    };

    const handleSaveCustomModel = (formData: CustomModelFormData) => {
        const modelIdRaw = formData.id.trim();
        if (!modelIdRaw) return;
        const modelId = modelIdRaw;
        const displayId = modelId.startsWith('openrouter/') ? modelId.replace('openrouter/', '') : modelId;
        const modelLabel = formData.label.trim() || formatModelName(displayId);

        const newModel = { id: modelId, label: modelLabel };
        const updatedModels = [...customModels.filter(m => m.id !== modelId), newModel];
        try {
            localStorage.setItem(STORAGE_KEY_CUSTOM_MODELS, JSON.stringify(updatedModels));
        } catch { }
        setCustomModels(updatedModels);
        onModelChange(modelId);
        try {
            localStorage.setItem(STORAGE_KEY_MODEL, modelId);
        } catch { }
        closeCustomModelDialog();
    };

    // combinedModels defined earlier

    const renderAgentIcon = (agent: any) => {
        return <AgentAvatar agentId={agent?.agent_id} size={16} className="h-4 w-4" fallbackName={agent?.name} />;
    };

    const displayAgent = useMemo(() => {
        const found = agents.find(a => a.agent_id === selectedAgentId) || agents[0];
        return found;
    }, [agents, selectedAgentId]);

    const currentAgentIdForPlaybooks = isLoggedIn ? displayAgent?.agent_id || '' : '';
    const { data: playbooks = [], isLoading: playbooksLoading } = useAgentWorkflows(currentAgentIdForPlaybooks);
    const [playbooksExpanded, setPlaybooksExpanded] = useState(true);

    return (
        <>
            {/* Reusable list of workflows to avoid re-fetch storms; each instance fetches scoped to agentId */}

            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 bg-transparent border-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/50 flex items-center gap-1.5"
                        aria-label="Config menu"
                    >
                        {onAgentSelect ? (
                            <div className="flex items-center gap-2 max-w-[140px]">
                                <div className="flex-shrink-0">
                                    {renderAgentIcon(displayAgent)}
                                </div>
                                <span className="truncate text-sm">
                                    {displayAgent?.name || 'Suna'}
                                </span>
                                <ChevronDown size={12} className="opacity-60" />
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5">
                                <Cpu className="h-4 w-4" />
                                <ChevronDown size={12} className="opacity-60" />
                            </div>
                        )}
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={6}>
                    <div className="p-2" ref={searchContainerRef}>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={handleSearchInputKeyDown}
                                className="w-full h-8 pl-8 pr-2 rounded-lg text-sm bg-muted focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Agents */}
                    {onAgentSelect && (
                        <div className="px-1.5">
                            <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                                <span>Agents</span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                    onClick={() => { setIsOpen(false); setShowNewAgentDialog(true); }}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            {topAgents.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground">No agents</div>
                            ) : (
                                <div className="max-h-[132px] overflow-y-auto">
                                    {filteredAgents.map((agent) => (
                                        <DropdownMenuItem
                                            key={agent.agent_id}
                                            className="text-sm px-3 py-2 mx-0 my-0.5 flex items-center justify-between cursor-pointer rounded-lg"
                                            onClick={() => handleAgentClick(agent.agent_id)}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                {renderAgentIcon(agent)}
                                                <span className="truncate">{agent.name}</span>
                                            </div>
                                            {selectedAgentId === agent.agent_id && (
                                                <Check className="h-4 w-4 text-blue-500" />
                                            )}
                                        </DropdownMenuItem>
                                    ))}
                                </div>
                            )}

                            {/* Agents "see all" removed; scroll container shows all */}
                            {/* Playbooks moved below (as hover submenu) */}
                        </div>
                    )}

                    {onAgentSelect && <DropdownMenuSeparator className="!mt-0" />}

                    {/* Models */}
                    <div className="px-1.5">
                        <div className="px-3 py-1 text-[11px] font-medium text-muted-foreground">Models</div>
                        {displayTopModels.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">No models</div>
                        ) : (
                            displayTopModels.map((m, idx) => (
                                <DropdownMenuItem
                                    key={`${m.id}-${idx}`}
                                    className={cn(
                                        'text-sm px-3 py-2 mx-0 my-0.5 flex items-center justify-between cursor-pointer rounded-lg',
                                        !canAccessModel(m.id) && 'opacity-60 cursor-not-allowed'
                                    )}
                                    onClick={() => canAccessModel(m.id) && handleModelClick(m.id)}
                                >
                                    <span className="truncate">{m.label}</span>
                                    <div className="flex items-center gap-2">
                                        {MODELS[m.id]?.recommended && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 font-medium">
                                                Recommended
                                            </span>
                                        )}
                                        {selectedModel === m.id && <Check className="h-4 w-4 text-blue-500" />}
                                    </div>
                                </DropdownMenuItem>
                            ))
                        )}

                        {/* All models with free overlay for non-subscribed users */}
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="flex items-center rounded-lg gap-2 px-3 py-2 mx-0 my-0.5">
                                <span className="font-medium">All models</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                                <DropdownMenuSubContent className="w-72 rounded-xl">
                                    <div className="max-h-80 overflow-y-auto">
                                        {isLocalMode() && (<div className="px-3 py-2 text-xs font-medium text-muted-foreground flex items-center justify-between">
                                            <span>All Models</span>
                                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={openAddCustomModelDialog}>
                                                <Plus className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                        )}
                                        {(!isLocalMode() && subscriptionStatus === 'no_subscription') ? (
                                            <div className="pb-2">
                                                <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Available Models</div>
                                                {combinedModels
                                                    .filter(m => !m.requiresSubscription)
                                                    .map((m, index) => (
                                                        <DropdownMenuItem
                                                            key={`${m.id}-${index}`}
                                                            className={cn('text-sm px-3 py-2 mx-0 my-0.5 flex items-center justify-between cursor-pointer rounded-lg')}
                                                            onClick={() => handleModelClick(m.id)}
                                                        >
                                                            <span className="truncate">{m.label}</span>
                                                            <div className="flex items-center gap-2">
                                                                {MODELS[m.id]?.recommended && (
                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 font-medium">Recommended</span>
                                                                )}
                                                                {selectedModel === m.id && <Check className="h-4 w-4 text-blue-500" />}
                                                            </div>
                                                        </DropdownMenuItem>
                                                    ))}

                                                <div className="mt-2 border-t border-border pt-2">
                                                    <div className="px-3 py-1.5 text-xs font-medium text-blue-500 flex items-center">
                                                        <Crown className="h-3.5 w-3.5 mr-1.5" />
                                                        Additional Models
                                                    </div>
                                                    <div className="relative h-40 overflow-hidden px-1.5">
                                                        {combinedModels
                                                            .filter(m => m.requiresSubscription)
                                                            .slice(0, 3)
                                                            .map((model, index) => (
                                                                <TooltipProvider key={`model-${model.id}-${index}`}>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <div className='w-full'>
                                                                                <DropdownMenuItem className="text-sm px-3 rounded-lg py-2 mx-1.5 my-0.5 flex items-center justify-between opacity-70 cursor-pointer pointer-events-none">
                                                                                    <div className="flex items-center">
                                                                                        <span className="font-medium">{model.label}</span>
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        {MODELS[model.id]?.recommended && (
                                                                                            <span className="text-xs px-1.5 py-0.5 rounded-sm bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 font-medium whitespace-nowrap">Recommended</span>
                                                                                        )}
                                                                                        <Crown className="h-3.5 w-3.5 text-blue-500" />
                                                                                    </div>
                                                                                </DropdownMenuItem>
                                                                            </div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent side="left" className="text-xs max-w-xs">
                                                                            <p>Requires subscription to access premium model</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            ))}

                                                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-transparent flex items-end justify-center">
                                                            <div className="w-full p-3">
                                                                <div className="rounded-xl bg-gradient-to-br from-blue-50/80 to-blue-200/70 dark:from-blue-950/40 dark:to-blue-900/30 shadow-sm border border-blue-200/50 dark:border-blue-800/50 p-3">
                                                                    <div className="flex flex-col space-y-2">
                                                                        <div className="flex items-center">
                                                                            <Crown className="h-4 w-4 text-blue-500 mr-2 flex-shrink-0" />
                                                                            <div>
                                                                                <p className="text-sm font-medium">Unlock all models + higher limits</p>
                                                                            </div>
                                                                        </div>
                                                                        <Button size="sm" className="w-full h-8 font-medium" onClick={handleUpgradeClick}>
                                                                            Upgrade now
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                {combinedModels.map((m, index) => (
                                                    <DropdownMenuItem
                                                        key={`${m.id}-${index}`}
                                                        className={cn('text-sm px-3 py-2 mx-0 my-0.5 flex items-center justify-between cursor-pointer rounded-lg')}
                                                        onClick={() => handleModelClick(m.id)}
                                                    >
                                                        <span className="truncate">{m.label}</span>
                                                        {selectedModel === m.id && <Check className="h-4 w-4 text-blue-500" />}
                                                    </DropdownMenuItem>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                        </DropdownMenuSub>
                    </div>

                    <DropdownMenuSeparator />

                    {/* Playbooks submenu (current agent) */}
                    {onAgentSelect && (
                        <div className="px-1.5">
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="flex items-center rounded-lg gap-2 px-3 py-2 mx-0 my-0.5">
                                    <span className="font-medium">Playbooks</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent className="w-72 rounded-xl max-h-80 overflow-y-auto">
                                        {playbooksLoading ? (
                                            <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>
                                        ) : playbooks && playbooks.length > 0 ? (
                                            playbooks.map((wf: any) => (
                                                <DropdownMenuItem
                                                    key={`pb-${wf.id}`}
                                                    className="text-sm px-3 py-2 mx-0 my-0.5 flex items-center justify-between cursor-pointer rounded-lg"
                                                    onClick={(e) => { e.stopPropagation(); setExecDialog({ open: true, playbook: wf, agentId: currentAgentIdForPlaybooks }); setIsOpen(false); }}
                                                >
                                                    <span className="truncate">{wf.name}</span>
                                                </DropdownMenuItem>
                                            ))
                                        ) : (
                                            <div className="px-3 py-2 text-xs text-muted-foreground">No playbooks</div>
                                        )}
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                        </div>
                    )}

                    {/* Quick Integrations */}
                    {(
                        <div className="px-1.5 pb-1.5">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <DropdownMenuItem
                                            className="text-sm px-3 py-2 mx-0 my-0.5 flex items-center justify-between cursor-pointer rounded-lg"
                                            onClick={() => setIntegrationsOpen(true)}
                                        >
                                            <span className="font-medium">Integrations</span>
                                            <div className="flex items-center gap-1.5">
                                                {googleDriveIcon?.icon_url && slackIcon?.icon_url && notionIcon?.icon_url ? (
                                                    <>
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={googleDriveIcon.icon_url} className="w-4 h-4" alt="Google Drive" />
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={slackIcon.icon_url} className="w-3.5 h-3.5" alt="Slack" />
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={notionIcon.icon_url} className="w-3.5 h-3.5" alt="Notion" />
                                                    </>
                                                ) : (
                                                    <>
                                                        <Skeleton className="w-4 h-4 rounded" />
                                                        <Skeleton className="w-3.5 h-3.5 rounded" />
                                                        <Skeleton className="w-3.5 h-3.5 rounded" />
                                                    </>
                                                )}
                                                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                            </div>
                                        </DropdownMenuItem>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="text-xs max-w-xs">
                                        <p>Open integrations</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Integrations manager */}
            <Dialog open={integrationsOpen} onOpenChange={setIntegrationsOpen}>
                <DialogContent className="p-0 max-w-6xl h-[90vh] overflow-hidden">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Integrations</DialogTitle>
                    </DialogHeader>
                    <IntegrationsRegistry
                        showAgentSelector={true}
                        selectedAgentId={selectedAgentId}
                        onAgentChange={onAgentSelect}
                        onClose={() => setIntegrationsOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            {/* Create Agent */}
            <NewAgentDialog open={showNewAgentDialog} onOpenChange={setShowNewAgentDialog} />

            {/* Execute Playbook */}
            <PlaybookExecuteDialog
                open={execDialog.open}
                onOpenChange={(open) => setExecDialog((s) => ({ ...s, open }))}
                playbook={execDialog.playbook as any}
                agentId={execDialog.agentId || ''}
            />

            <CustomModelDialog
                isOpen={isCustomModelDialogOpen}
                onClose={closeCustomModelDialog}
                onSave={handleSaveCustomModel}
                initialData={dialogInitialData}
                mode={"add"}
            />
        </>
    );
};

const GuestMenu: React.FC<UnifiedConfigMenuProps> = () => {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="inline-flex">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 bg-transparent border-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/50 flex items-center gap-1.5 cursor-not-allowed opacity-80 pointer-events-none"
                            disabled
                        >
                            <div className="flex items-center gap-2 max-w-[160px]">
                                <div className="flex-shrink-0">
                                    <KortixLogo size={16} />
                                </div>
                                <span className="truncate text-sm">Suna</span>
                                <ChevronDown size={12} className="opacity-60" />
                            </div>
                        </Button>
                    </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                    <p>Log in to change agent</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

export const UnifiedConfigMenu: React.FC<UnifiedConfigMenuProps> = (props) => {
    if (props.isLoggedIn) {
        return <LoggedInMenu {...props} />;
    }
    return <GuestMenu {...props} />;
};

export default UnifiedConfigMenu;


