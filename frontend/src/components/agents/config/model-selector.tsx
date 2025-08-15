'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, Search, AlertTriangle, Crown, Cpu, Plus, Edit, Trash, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { 
  useModelSelection, 
  MODELS,
  STORAGE_KEY_CUSTOM_MODELS,
  formatModelName,
  getCustomModels,
  DEFAULT_FREE_MODEL_ID,
  DEFAULT_PREMIUM_MODEL_ID
} from '@/components/thread/chat-input/_use-model-selection';
import { useAvailableModels } from '@/hooks/react-query/subscriptions/use-billing';
import { isLocalMode } from '@/lib/config';
import { CustomModelDialog, CustomModelFormData } from '@/components/thread/chat-input/custom-model-dialog';
import { PaywallDialog } from '@/components/payment/paywall-dialog';
import { BillingModal } from '@/components/billing/billing-modal';
import Link from 'next/link';

interface CustomModel {
  id: string;
  label: string;
}

interface AgentModelSelectorProps {
  value?: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

export function AgentModelSelector({
  value,
  onChange,
  disabled = false,
}: AgentModelSelectorProps) {
  const { allModels, canAccessModel, subscriptionStatus } = useModelSelection();
  const { data: modelsData } = useAvailableModels();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Paywall and billing states
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [lockedModel, setLockedModel] = useState<string | null>(null);
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  
  // Custom model states for local mode
  const [customModels, setCustomModels] = useState<CustomModel[]>([]);
  const [isCustomModelDialogOpen, setIsCustomModelDialogOpen] = useState(false);
  const [dialogInitialData, setDialogInitialData] = useState<CustomModelFormData>({ id: '', label: '' });
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingModelId, setEditingModelId] = useState<string | null>(null);

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
  
  const normalizeModelId = (modelId?: string): string => {
    if (!modelId) return isLocalMode() ? DEFAULT_PREMIUM_MODEL_ID : DEFAULT_FREE_MODEL_ID;
    
    if (modelsData?.models) {
      const exactMatch = modelsData.models.find(m => m.short_name === modelId);
      if (exactMatch) return exactMatch.short_name;

      const fullMatch = modelsData.models.find(m => m.id === modelId);
      if (fullMatch) return fullMatch.short_name || fullMatch.id;
      
      if (modelId.startsWith('openrouter/')) {
        const shortName = modelId.replace('openrouter/', '');
        const shortMatch = modelsData.models.find(m => m.short_name === shortName);
        if (shortMatch) return shortMatch.short_name;
      }
    }
    
    return modelId;
  };
  
  const selectedModel = normalizeModelId(value);

  const enhancedModelOptions = useMemo(() => {
    const modelMap = new Map();

    allModels.forEach(model => {
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

    return Array.from(modelMap.values());
  }, [allModels, customModels]);
  
  const selectedModelDisplay = useMemo(() => {
    const model = enhancedModelOptions.find(m => m.id === selectedModel);
    return model?.label || selectedModel;
  }, [selectedModel, enhancedModelOptions]);

  const filteredOptions = useMemo(() => {
    return enhancedModelOptions.filter((opt) =>
      opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opt.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [enhancedModelOptions, searchQuery]);

  const sortedModels = useMemo(() => {
    return [...filteredOptions].sort((a, b) => {
      if (a.requiresSubscription !== b.requiresSubscription) {
        return a.requiresSubscription ? 1 : -1;
      }
      return (b.priority ?? 0) - (a.priority ?? 0);
    });
  }, [filteredOptions]);

  const freeModels = sortedModels.filter(m => !m.requiresSubscription);
  const premiumModels = sortedModels.filter(m => m.requiresSubscription);

  const shouldDisplayAll = (!isLocalMode() && subscriptionStatus === 'no_subscription') && premiumModels.length > 0;

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

  const handleSelect = (modelId: string) => {
    const isCustomModel = customModels.some(model => model.id === modelId);
    
    if (isCustomModel && isLocalMode()) {
      onChange(modelId);
      setIsOpen(false);
      return;
    }
    
    if (isLocalMode() || canAccessModel(modelId)) {
      let fullModelId = modelId;
      if (modelsData?.models) {
        const modelMatch = modelsData.models.find(m => m.short_name === modelId);
        if (modelMatch) {
          fullModelId = modelMatch.id;
        }
      }
      onChange(fullModelId);
      setIsOpen(false);
    } else {
      setLockedModel(modelId);
      setPaywallOpen(true);
    }
  };

  const handleUpgradeClick = () => {
    setBillingModalOpen(true);
  };

  const closePaywallDialog = () => {
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

    if (dialogMode === 'add') {
      onChange(modelId);
    } else if (selectedModel === editingModelId) {
      onChange(modelId);
    }
    
    setIsOpen(false);
  };

  const closeCustomModelDialog = () => {
    setIsCustomModelDialogOpen(false);
    setDialogInitialData({ id: '', label: '' });
    setEditingModelId(null);
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
    
    if (selectedModel === modelId) {
      const defaultModel = isLocalMode() ? DEFAULT_PREMIUM_MODEL_ID : DEFAULT_FREE_MODEL_ID;
      onChange(defaultModel);
    }
  };

  const renderModelOption = (model: any, index: number) => {
    const isCustom = Boolean(model.isCustom) || 
      (isLocalMode() && customModels.some(m => m.id === model.id));
    const accessible = isCustom ? true : (isLocalMode() || canAccessModel(model.id));
    const isHighlighted = index === highlightedIndex;
    const isPremium = model.requiresSubscription;
    const isLowQuality = MODELS[model.id]?.lowQuality || false;
    const isRecommended = MODELS[model.id]?.recommended || false;

    return (
      <TooltipProvider key={`model-${model.id}-${index}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className='w-full'>
              <DropdownMenuItem
                className={cn(
                  "text-sm px-3 rounded-lg py-2 mx-2 my-0.5 flex items-center justify-between cursor-pointer",
                  isHighlighted && "bg-accent",
                  !accessible && !disabled && "opacity-70"
                )}
                onClick={() => !disabled && handleSelect(model.id)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div className="flex items-center">
                  <span className="font-medium">{model.label}</span>
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
                  {isPremium && !accessible && !isLocalMode() && (
                    <Crown className="h-3.5 w-3.5 text-blue-500" />
                  )}
                  {isLocalMode() && isCustom && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditCustomModelDialog(model, e);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustomModel(model.id, e);
                        }}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  {selectedModel === model.id && (
                    <Check className="h-4 w-4 text-blue-500" />
                  )}
                </div>
              </DropdownMenuItem>
            </div>
          </TooltipTrigger>
          {!accessible && !isLocalMode() ? (
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

  return (
    <div className="relative">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild disabled={disabled}>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 px-4 py-2",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="relative flex items-center justify-center">
                    <Cpu className="h-4 w-4" />
                    {MODELS[selectedModel]?.lowQuality && (
                      <AlertTriangle className="h-2.5 w-2.5 text-amber-500 absolute -top-1 -right-1" />
                    )}
                  </div>
                  <span className="text-sm">{selectedModelDisplay}</span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p>Choose a model for this agent</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent
          align="start"
          className="w-72 p-0 overflow-hidden"
          sideOffset={4}
        >
          <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent w-full">
            <div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-muted-foreground p-2 px-4">All Models</span>
                {isLocalMode() && (
                  <div className="flex items-center gap-1 p-2">
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
              <div className="px-1 py-1">
                <div className="relative px-1 flex items-center">
                  <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
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
                  {freeModels.map((model, index) => renderModelOption(model, index))}
                  
                  {premiumModels.length > 0 && (
                    <>
                      <div className="mt-4 border-t border-border pt-2">
                        <div className="px-3 py-1.5 text-xs font-medium text-blue-500 flex items-center">
                          <Crown className="h-3.5 w-3.5 mr-1.5" />
                          Additional Models
                        </div>
                        <div className="relative h-40 overflow-hidden px-2">
                          {premiumModels.slice(0, 3).map((model, index) => (
                            <TooltipProvider key={`premium-${model.id}-${index}`}>
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
                    </>
                  )}
                </div>
              ) : (
                <div>
                  {sortedModels.length > 0 ? (
                    sortedModels.map((model, index) => renderModelOption(model, index))
                  ) : (
                    <div className="text-sm text-center py-4 text-muted-foreground">
                      No models match your search
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      {isLocalMode() && (
        <CustomModelDialog
          isOpen={isCustomModelDialogOpen}
          onClose={closeCustomModelDialog}
          onSave={handleSaveCustomModel}
          initialData={dialogInitialData}
          mode={dialogMode}
        />
      )}
      {paywallOpen && (
        <PaywallDialog
          open={true}
          onDialogClose={closePaywallDialog}
          title="Premium Model"
          description={
            lockedModel
              ? `Subscribe to access ${enhancedModelOptions.find(
                  (m) => m.id === lockedModel
                )?.label}`
              : 'Subscribe to access premium models with enhanced capabilities'
          }
          ctaText="Subscribe Now"
          cancelText="Maybe Later"
        />
      )}
      <BillingModal
        open={billingModalOpen}
        onOpenChange={setBillingModalOpen}
      />
    </div>
  );
}
