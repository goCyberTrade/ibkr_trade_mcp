'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Check, Search, AlertTriangle, Crown, ArrowUpRight, Brain, Plus, Edit, Trash, Cpu, KeyRound, ExternalLink } from 'lucide-react';
import {
  ModelOption,
  SubscriptionStatus,
  STORAGE_KEY_MODEL,
  STORAGE_KEY_CUSTOM_MODELS,
  DEFAULT_FREE_MODEL_ID,
  DEFAULT_PREMIUM_MODEL_ID,
  formatModelName,
  getCustomModels,
  MODELS
} from './_use-model-selection';
import { PaywallDialog } from '@/components/payment/paywall-dialog';
import { cn } from '@/lib/utils';
import { isLocalMode } from '@/lib/config';
import { CustomModelDialog, CustomModelFormData } from './custom-model-dialog';
import Link from 'next/link';
import { IntegrationsRegistry } from '@/components/agents/integrations-registry';
import { ComposioConnector } from '@/components/agents/composio/composio-connector';
import { useComposioToolkitIcon } from '@/hooks/react-query/composio/use-composio';
import { useComposioProfiles } from '@/hooks/react-query/composio/use-composio-profiles';
import { useAgent } from '@/hooks/react-query/agents/use-agents';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeatureFlag } from '@/lib/feature-flags';

const PREDEFINED_APPS = [
  {
    id: 'googledrive',
    name: 'Google Drive',
    slug: 'googledrive',
    description: 'Access and manage files in Google Drive'
  },
  {
    id: 'slack',
    name: 'Slack',
    slug: 'slack',
    description: 'Send messages and manage channels'
  },
  {
    id: 'gmail',
    name: 'Gmail',
    slug: 'gmail',
    description: 'Send and manage emails'
  },
  {
    id: 'notion',
    name: 'Notion',
    slug: 'notion',
    description: 'Create and manage Notion pages'
  }
];

interface CustomModel {
  id: string;
  label: string;
}


interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  modelOptions: ModelOption[];
  canAccessModel: (modelId: string) => boolean;
  subscriptionStatus: SubscriptionStatus;
  refreshCustomModels?: () => void;
  billingModalOpen: boolean;
  setBillingModalOpen: (open: boolean) => void;
  hasBorder?: boolean;
  selectedAgentId?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  modelOptions,
  canAccessModel,
  subscriptionStatus,
  refreshCustomModels,
  billingModalOpen,
  setBillingModalOpen,
  hasBorder = false,
  selectedAgentId,
}) => {
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [lockedModel, setLockedModel] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [mounted, setMounted] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fix hydration mismatch by ensuring component only renders after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Custom models state
  const [customModels, setCustomModels] = useState<CustomModel[]>([]);
  const [isCustomModelDialogOpen, setIsCustomModelDialogOpen] = useState(false);
  const [dialogInitialData, setDialogInitialData] = useState<CustomModelFormData>({ id: '', label: '' });
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingModelId, setEditingModelId] = useState<string | null>(null);

  const [showIntegrationsManager, setShowIntegrationsManager] = useState(false);
  const [selectedApp, setSelectedApp] = useState<typeof PREDEFINED_APPS[0] | null>(null);
  const [showComposioConnector, setShowComposioConnector] = useState(false);

  const { data: googleDriveIcon } = useComposioToolkitIcon('googledrive', { enabled: true });
  const { data: slackIcon } = useComposioToolkitIcon('slack', { enabled: true });
  const { data: gmailIcon } = useComposioToolkitIcon('gmail', { enabled: true });
  const { data: notionIcon } = useComposioToolkitIcon('notion', { enabled: true });

  const { data: selectedAppIcon } = useComposioToolkitIcon(selectedApp?.slug || '', {
    enabled: !!selectedApp?.slug && showComposioConnector
  });

  const appIconMap = {
    'googledrive': googleDriveIcon?.icon_url,
    'slack': slackIcon?.icon_url,
    'gmail': gmailIcon?.icon_url,
    'notion': notionIcon?.icon_url,
  };

  const { data: agent } = useAgent(selectedAgentId || '');
  const { data: profiles } = useComposioProfiles();

  const { enabled: customAgentsEnabled } = useFeatureFlag('custom_agents');

  const isAppConnectedToAgent = (appSlug: string): boolean => {
    if (!selectedAgentId || !agent?.custom_mcps || !profiles) return false;

    return agent.custom_mcps.some((mcpConfig: any) => {
      if (mcpConfig.config?.profile_id) {
        const profile = profiles.find(p => p.profile_id === mcpConfig.config.profile_id);
        return profile?.toolkit_slug === appSlug;
      }
      return false;
    });
  };

  useEffect(() => {
    if (isLocalMode()) {
      setCustomModels(getCustomModels());
    }
  }, []);

  useEffect(() => {
    if (isLocalMode() && customModels.length > 0) {
      localStorage.setItem(STORAGE_KEY_CUSTOM_MODELS, JSON.stringify(customModels));
    }
  }, [customModels]);

  const modelMap = new Map();

  modelOptions.forEach(model => {
    modelMap.set(model.id, {
      ...model,
      isCustom: false
    });
  });

  if (isLocalMode()) {
    customModels.forEach(model => {
      if (!modelMap.has(model.id)) {
        modelMap.set(model.id, {
          id: model.id,
          label: model.label || formatModelName(model.id),
          requiresSubscription: false,
          top: false,
          isCustom: true
        });
      } else {
        const existingModel = modelMap.get(model.id);
        modelMap.set(model.id, {
          ...existingModel,
          isCustom: true
        });
      }
    });
  }

  const enhancedModelOptions = Array.from(modelMap.values());

  const filteredOptions = enhancedModelOptions.filter((opt) =>
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    opt.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFreeModels = () => modelOptions.filter(m => !m.requiresSubscription).map(m => m.id);

  const sortedModels = filteredOptions;
  const getPremiumModels = () => {
    return modelOptions
      .filter(m => m.requiresSubscription)
      .map((m, index) => ({
        ...m,
        uniqueKey: getUniqueModelKey(m, index)
      }));
  }

  const getUniqueModelKey = (model: any, index: number): string => {
    return `model-${model.id}-${index}`;
  };

  const uniqueModels = sortedModels.map((model, index) => ({
    ...model,
    uniqueKey: getUniqueModelKey(model, index)
  }));

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  const selectedLabel =
    enhancedModelOptions.find((o) => o.id === selectedModel)?.label || 'Select model';

  const handleSelect = (id: string) => {
    const isCustomModel = customModels.some(model => model.id === id);
    if (isCustomModel && isLocalMode()) {
      onModelChange(id);
      setIsOpen(false);
      return;
    }
    if (canAccessModel(id)) {
      onModelChange(id);
      setIsOpen(false);
    } else {
      setLockedModel(id);
      setPaywallOpen(true);
    }
  };

  const handleUpgradeClick = () => {
    setBillingModalOpen(true);
  };

  const closeDialog = () => {
    setPaywallOpen(false);
    setLockedModel(null);
  };

  const handleSearchInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      const selectedOption = filteredOptions[highlightedIndex];
      if (selectedOption) {
        handleSelect(selectedOption.id);
      }
    }
  };

  const premiumModels = sortedModels.filter(m => !getFreeModels().some(id => m.id.includes(id)));

  const shouldDisplayAll = (!isLocalMode() && subscriptionStatus === 'no_subscription') && premiumModels.length > 0;

  const openAddCustomModelDialog = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDialogInitialData({ id: '', label: '' });
    setDialogMode('add');
    setIsCustomModelDialogOpen(true);
    setIsOpen(false);
  };

  const openEditCustomModelDialog = (model: CustomModel, e?: React.MouseEvent) => {
    e?.stopPropagation();

    setDialogInitialData({ id: model.id, label: model.label });
    setEditingModelId(model.id);
    setDialogMode('edit');
    setIsCustomModelDialogOpen(true);
    setIsOpen(false);
  };

  const handleSaveCustomModel = (formData: CustomModelFormData) => {
    const modelId = formData.id.trim();
    const displayId = modelId.startsWith('openrouter/') ? modelId.replace('openrouter/', '') : modelId;
    const modelLabel = formData.label.trim() || formatModelName(displayId);

    if (!modelId) return;
    const checkId = modelId;
    if (customModels.some(model =>
      model.id === checkId && (dialogMode === 'add' || model.id !== editingModelId))) {
      console.error('A model with this ID already exists');
      return;
    }

    closeCustomModelDialog();
    const newModel = { id: modelId, label: modelLabel };

    const updatedModels = dialogMode === 'add'
      ? [...customModels, newModel]
      : customModels.map(model => model.id === editingModelId ? newModel : model);

    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_MODELS, JSON.stringify(updatedModels));
    } catch (error) {
      console.error('Failed to save custom models to localStorage:', error);
    }

    setCustomModels(updatedModels);
    if (refreshCustomModels) {
      refreshCustomModels();
    }

    if (dialogMode === 'add') {
      onModelChange(modelId);
      try {
        localStorage.setItem(STORAGE_KEY_MODEL, modelId);
      } catch (error) {
        console.warn('Failed to save selected model to localStorage:', error);
      }
    } else if (selectedModel === editingModelId) {
      onModelChange(modelId);
      try {
        localStorage.setItem(STORAGE_KEY_MODEL, modelId);
      } catch (error) {
        console.warn('Failed to save selected model to localStorage:', error);
      }
    }
    setIsOpen(false);
    setTimeout(() => {
      setHighlightedIndex(-1);
    }, 0);
  };

  const closeCustomModelDialog = () => {
    setIsCustomModelDialogOpen(false);
    setDialogInitialData({ id: '', label: '' });
    setEditingModelId(null);
    document.body.classList.remove('overflow-hidden');
    const bodyStyle = document.body.style;
    setTimeout(() => {
      bodyStyle.pointerEvents = '';
      bodyStyle.removeProperty('pointer-events');
    }, 150);
  };

  const handleDeleteCustomModel = (modelId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();

    const updatedCustomModels = customModels.filter(model => model.id !== modelId);
    if (isLocalMode() && typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_CUSTOM_MODELS, JSON.stringify(updatedCustomModels));
      } catch (error) {
        console.error('Failed to update custom models in localStorage:', error);
      }
    }
    setCustomModels(updatedCustomModels);
    if (refreshCustomModels) {
      refreshCustomModels();
    }
    if (selectedModel === modelId) {
      const defaultModel = isLocalMode() ? DEFAULT_PREMIUM_MODEL_ID : DEFAULT_FREE_MODEL_ID;
      onModelChange(defaultModel);
      try {
        localStorage.setItem(STORAGE_KEY_MODEL, defaultModel);
      } catch (error) {
        console.warn('Failed to update selected model in localStorage:', error);
      }
    }
    setIsOpen(false);
    setTimeout(() => {
      setHighlightedIndex(-1);
      if (isOpen) {
        setIsOpen(false);
        setTimeout(() => setIsOpen(true), 50);
      }
    }, 10);
  };

  const handleAppSelect = (app: typeof PREDEFINED_APPS[0]) => {
    setSelectedApp(app);
    setShowComposioConnector(true);
    setIsOpen(false);
  };

  const handleComposioComplete = (profileId: string, appName: string, appSlug: string) => {
    setShowComposioConnector(false);
    setSelectedApp(null);
  };

  const handleOpenIntegrationsManager = () => {
    setShowIntegrationsManager(true);
    setIsOpen(false);
  };

  const renderModelOption = (opt: any, index: number) => {
    const isCustom = Boolean(opt.isCustom) ||
      (isLocalMode() && customModels.some(model => model.id === opt.id));

    const accessible = isCustom ? true : canAccessModel(opt.id);
    const isHighlighted = index === highlightedIndex;
    const isPremium = opt.requiresSubscription;
    const isLowQuality = MODELS[opt.id]?.lowQuality || false;
    const isRecommended = MODELS[opt.id]?.recommended || false;

    return (
      <TooltipProvider key={opt.uniqueKey || `model-${opt.id}-${index}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className='w-full'>
              <DropdownMenuItem
                className={cn(
                  "text-sm px-3 rounded-lg py-2 mx-2 my-0.5 flex items-center justify-between cursor-pointer",
                  isHighlighted && "bg-accent",
                  !accessible && "opacity-70"
                )}
                onClick={() => handleSelect(opt.id)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div className="flex items-center">
                  <span className="font-medium">{opt.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isLowQuality && (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  {isRecommended && (
                    <span className="text-xs px-1.5 py-0.5 rounded-sm bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 font-medium">
                      Recommended
                    </span>
                  )}
                  {isPremium && !accessible && (
                    <Crown className="h-3.5 w-3.5 text-blue-500" />
                  )}
                  {isLocalMode() && isCustom && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditCustomModelDialog(opt, e);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustomModel(opt.id, e);
                        }}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  {selectedModel === opt.id && (
                    <Check className="h-4 w-4 text-blue-500" />
                  )}
                </div>
              </DropdownMenuItem>
            </div>
          </TooltipTrigger>
          {!accessible ? (
            <TooltipContent side="left" className="text-xs max-w-xs">
              <p>Requires subscription to access premium model</p>
            </TooltipContent>
          ) : isLowQuality ? (
            <TooltipContent side="left" className="text-xs max-w-xs">
              <p>Not recommended for complex tasks</p>
            </TooltipContent>
          ) : isRecommended ? (
            <TooltipContent side="left" className="text-xs max-w-xs">
              <p>Recommended for optimal performance</p>
            </TooltipContent>
          ) : isCustom ? (
            <TooltipContent side="left" className="text-xs max-w-xs">
              <p>Custom model</p>
            </TooltipContent>
          ) : null}
        </Tooltip>
      </TooltipProvider>
    );
  };

  useEffect(() => {
    setHighlightedIndex(-1);
    setSearchQuery('');
    if (isOpen) {
      setIsOpen(false);
      setTimeout(() => setIsOpen(true), 10);
    }
  }, [customModels, modelOptions]);

  // Don't render dropdown until after hydration to prevent ID mismatches
  if (!mounted) {
    return <div className="h-8 px-2 py-2" />; // Placeholder with same height
  }

  return (
    <div className="relative">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 py-2 bg-transparent border-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/50 flex items-center gap-2"
                >
                  <div className="relative flex items-center justify-center">
                    <Cpu className="h-4 w-4" />
                    {MODELS[selectedModel]?.lowQuality && (
                      <AlertTriangle className="h-2.5 w-2.5 text-amber-500 absolute -top-1 -right-1" />
                    )}
                  </div>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p>Choose a model</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent
          align="end"
          className="w-72 p-0 overflow-hidden"
          sideOffset={4}
        >
          <div className="max-h-[400px] overflow-y-auto w-full">
            <div className="p-2">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center rounded-lg gap-2 px-2 py-2">
                  <Cpu className="h-4 w-4" />
                  <span className="font-medium">Models</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-72">
                    <div className="px-3 py-2 flex justify-between items-center">
                      <span className="text-xs font-medium text-muted-foreground">All Models</span>
                      {isLocalMode() && (
                        <div className="flex items-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link
                                  href="/settings/env-manager"
                                  className="h-6 w-6 p-0 flex items-center justify-center"
                                >
                                  <KeyRound className="h-3.5 w-3.5" />
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="text-xs">
                                Local .Env Manager
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAddCustomModelDialog(e);
                                  }}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="text-xs">
                                Add a custom model
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )}
                    </div>
                    <div className="px-2 py-1">
                      <div className="relative flex items-center">
                        <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          placeholder="Search models..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={handleSearchInputKeyDown}
                          className="w-full h-8 px-8 py-1 rounded-lg text-sm focus:outline-none bg-muted"
                        />
                      </div>
                    </div>
                    
                    {shouldDisplayAll ? (
                      <div>
                        <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                          Available Models
                        </div>
                        {uniqueModels
                          .filter(m =>
                            !m.requiresSubscription &&
                            (m.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              m.id.toLowerCase().includes(searchQuery.toLowerCase()))
                          )
                          .map((model, index) => renderModelOption(model, index))}
                        
                        <div className="mt-4 border-t border-border pt-2">
                          <div className="px-3 py-1.5 text-xs font-medium text-blue-500 flex items-center">
                            <Crown className="h-3.5 w-3.5 mr-1.5" />
                            Additional Models
                          </div>
                          <div className="relative h-40 overflow-hidden px-2">
                            {getPremiumModels()
                              .filter(m =>
                                m.requiresSubscription &&
                                (m.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  m.id.toLowerCase().includes(searchQuery.toLowerCase()))
                              )
                              .slice(0, 3)
                              .map((model, index) => (
                                <TooltipProvider key={model.uniqueKey || `model-${model.id}-${index}`}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className='w-full'>
                                        <DropdownMenuItem
                                          className="text-sm px-3 rounded-lg py-2 mx-2 my-0.5 flex items-center justify-between opacity-70 cursor-pointer pointer-events-none"
                                        >
                                          <div className="flex items-center">
                                            <span className="font-medium">{model.label}</span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {MODELS[model.id]?.recommended && (
                                              <span className="text-xs px-1.5 py-0.5 rounded-sm bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 font-medium whitespace-nowrap">
                                                Recommended
                                              </span>
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
                              ))
                            }
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
                                    <Button
                                      size="sm"
                                      className="w-full h-8 font-medium"
                                      onClick={handleUpgradeClick}
                                    >
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
                        {uniqueModels
                          .filter(m =>
                            m.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            m.id.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .map((model, index) => renderModelOption(model, index))}
                        {uniqueModels.length === 0 && (
                          <div className="text-sm text-center py-4 text-muted-foreground">
                            No models match your search
                          </div>
                        )}
                      </div>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              {customAgentsEnabled && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="flex rounded-lg items-center gap-2 px-2 py-2">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      <span className="font-medium">Quick Connect</span>
                    </div>
                    <div className="flex items-center space-x-0.5">
                      {googleDriveIcon?.icon_url && slackIcon?.icon_url && notionIcon?.icon_url ? (
                        <>
                          <img src={googleDriveIcon.icon_url} className="w-5 h-5" alt="Google Drive" />
                          <img src={slackIcon.icon_url} className="w-4 h-4" alt="Slack" />
                          <img src={notionIcon.icon_url} className="w-4 h-4" alt="Notion" />
                        </>
                      ) : (
                        <>
                          <Skeleton className="w-4 h-4 rounded-md" />
                          <Skeleton className="w-4 h-4 rounded-md" />
                          <Skeleton className="w-4 h-4 rounded-md" />
                        </>
                      )}
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent className="w-64 rounded-xl">
                      <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                        Popular Apps
                      </div>
                      <div className="px-1 space-y-1">
                        {!selectedAgentId || !agent || !profiles ? (
                          <>
                            {Array.from({ length: 4 }).map((_, index) => (
                              <div key={index} className="px-3 py-2 mx-0 my-0.5 flex items-center justify-between">
                                <div className="flex items-center">
                                  <Skeleton className="w-4 h-4 mr-2 rounded" />
                                  <Skeleton className="w-20 h-4 rounded" />
                                </div>
                                <Skeleton className="w-4 h-4 rounded" />
                              </div>
                            ))}
                          </>
                        ) : (
                          PREDEFINED_APPS.map((app) => {
                            const isConnected = isAppConnectedToAgent(app.slug);
                            return (
                              <TooltipProvider key={app.id}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <DropdownMenuItem
                                      className={cn(
                                        "text-sm px-3 rounded-lg py-2 mx-0 my-0.5 flex items-center justify-between",
                                        isConnected 
                                          ? "opacity-60 cursor-not-allowed" 
                                          : "cursor-pointer hover:bg-accent/50"
                                      )}
                                      onClick={isConnected ? undefined : () => handleAppSelect(app)}
                                      disabled={isConnected}
                                    >
                                      <div className="flex items-center">
                                        {appIconMap[app.slug] ? (
                                          <img src={appIconMap[app.slug]} alt={app.name} className="h-4 w-4 mr-2" />
                                        ) : (
                                          <div className="w-4 h-4 mr-2 rounded bg-primary/10 flex items-center justify-center">
                                            <span className="text-xs text-primary font-medium">{app.name.charAt(0)}</span>
                                          </div>
                                        )}
                                        <span className="font-medium">{app.name}</span>
                                        {isConnected && (
                                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded-sm bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 font-medium">
                                            Connected
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {isConnected ? (
                                          <Check className="h-3.5 w-3.5 text-green-500" />
                                        ) : (
                                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                        )}
                                      </div>
                                    </DropdownMenuItem>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="text-xs max-w-xs">
                                    <p>{isConnected ? `Manage ${app.name} tools` : app.description}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })
                        )}
                      </div>
                      
                      <div className="px-1 pt-2 border-t border-border/50 mt-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuItem
                                className="text-sm px-3 rounded-lg py-2 mx-0 my-0.5 flex items-center justify-between cursor-pointer hover:bg-accent/50"
                                onClick={handleOpenIntegrationsManager}
                              >
                                <div className="flex items-center gap-2">
                                  <Plus className="h-4 w-4" />
                                  <span className="font-medium">Discover more apps</span>
                                </div>
                                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                              </DropdownMenuItem>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-xs max-w-xs">
                              <p>Open full integrations manager</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              )}
            </div>
          </div>

        </DropdownMenuContent>
      </DropdownMenu>
      <CustomModelDialog
        isOpen={isCustomModelDialogOpen}
        onClose={closeCustomModelDialog}
        onSave={handleSaveCustomModel}
        initialData={dialogInitialData}
        mode={dialogMode}
      />
      <Dialog open={showIntegrationsManager} onOpenChange={setShowIntegrationsManager}>
        <DialogContent className="p-0 max-w-6xl h-[90vh] overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Integrations Manager</DialogTitle>
          </DialogHeader>
          <IntegrationsRegistry
            showAgentSelector={true}
            selectedAgentId={selectedAgentId}
            onClose={() => setShowIntegrationsManager(false)}
          />
        </DialogContent>
      </Dialog>
      {selectedApp && (
        <ComposioConnector
          app={{
            slug: selectedApp.slug,
            name: selectedApp.name,
            description: selectedApp.description,
            categories: ['productivity'],
            tags: [],
            auth_schemes: [],
            logo: selectedAppIcon?.icon_url || ''
          }}
          agentId={selectedAgentId}
          open={showComposioConnector}
          onOpenChange={setShowComposioConnector}
          onComplete={handleComposioComplete}
          mode="full"
        />
      )}
      {paywallOpen && (
        <PaywallDialog
          open={true}
          onDialogClose={closeDialog}
          title="Premium Model"
          description={
            lockedModel
              ? `Subscribe to access ${modelOptions.find(
                (m) => m.id === lockedModel
              )?.label}`
              : 'Subscribe to access premium models with enhanced capabilities'
          }
          ctaText="Subscribe Now"
          cancelText="Maybe Later"
        />
      )}
    </div>
  );
};

