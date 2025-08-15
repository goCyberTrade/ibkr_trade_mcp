import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Save, AlertCircle, Loader2 } from 'lucide-react';
import { backendApi } from '@/lib/api-client';
import { composioApi } from '@/hooks/react-query/composio/utils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface Tool {
  name: string;
  description: string;
  parameters: any;
}

interface ComposioToolsSelectorProps {
  profileId: string;
  agentId?: string;
  toolkitName: string;
  selectedTools: string[];
  onToolsChange: (tools: string[]) => void;
  onSave?: () => Promise<void>;
  onCancel?: () => void;
  showSaveButton?: boolean;
  className?: string;
  searchPlaceholder?: string;
}

const ToolCard = ({ tool, isSelected, onToggle, searchTerm }: {
  tool: Tool;
  isSelected: boolean;
  onToggle: () => void;
  searchTerm: string;
}) => {
  const highlightText = (text: string, term: string) => {
    if (!term) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/50">{part}</mark> : part
    );
  };

  return (
    <Card className={cn(
      "group cursor-pointer transition-all p-0 shadow-none bg-card hover:bg-muted/50",
      isSelected && "bg-primary/10 ring-1 ring-primary/20"
    )}>
      <CardContent className="p-4" onClick={onToggle}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-medium text-sm truncate">
                {highlightText(tool.name, searchTerm)}
              </h3>
            </div>
            
            <p className="text-xs text-muted-foreground line-clamp-2">
              {highlightText(tool.description || 'No description available', searchTerm)}
            </p>
            
            {tool.parameters?.properties && (
              <div className="mt-2">
                <Badge variant="outline" className="text-xs">
                  {Object.keys(tool.parameters.properties).length} parameters
                </Badge>
              </div>
            )}
          </div>
          
          <div className="flex-shrink-0 ml-2">
            <Switch
              checked={isSelected}
              onCheckedChange={onToggle}
              className="data-[state=checked]:bg-primary"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ToolSkeleton = () => (
  <Card className="shadow-none p-0 bg-muted/30">
    <CardContent className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-6 w-11 rounded-full flex-shrink-0" />
      </div>
    </CardContent>
  </Card>
);

export const ComposioToolsSelector: React.FC<ComposioToolsSelectorProps> = ({
  profileId,
  agentId,
  toolkitName,
  selectedTools,
  onToolsChange,
  onSave,
  onCancel,
  showSaveButton = true,
  className,
  searchPlaceholder = "Search tools..."
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredTools = useMemo(() => {
    if (!searchTerm) return availableTools;
    const term = searchTerm.toLowerCase();
    return availableTools.filter(tool =>
      tool.name.toLowerCase().includes(term) ||
      (tool.description && tool.description.toLowerCase().includes(term))
    );
  }, [availableTools, searchTerm]);

  useEffect(() => {
    if (profileId) {
      console.log('ComposioToolsSelector: Loading tools for profile', profileId);
      loadTools();
      if (agentId) {
        loadCurrentAgentTools();
      }
    }
  }, [profileId, agentId]);

  const loadTools = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('ComposioToolsSelector: Discovering tools for profile', profileId);
      const response = await composioApi.discoverTools(profileId);
      console.log('ComposioToolsSelector: Tools response', response);
      if (response.success && response.tools) {
        setAvailableTools(response.tools);
        console.log('ComposioToolsSelector: Loaded', response.tools.length, 'tools');
      } else {
        setError('Failed to load available tools');
        console.error('ComposioToolsSelector: Failed to load tools', response);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load tools');
      console.error('ComposioToolsSelector: Error loading tools', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCurrentAgentTools = async () => {
    if (!agentId) return;
    
    try {
      console.log('ComposioToolsSelector: Loading current agent tools for agent', agentId, 'profile', profileId);
      const response = await backendApi.get(`/agents/${agentId}`);
      if (response.success && response.data) {
        const agent = response.data;
        console.log('ComposioToolsSelector: Agent data', agent);
        const composioMcps = agent.custom_mcps?.filter((mcp: any) => 
          mcp.type === 'composio' && mcp.config?.profile_id === profileId
        ) || [];
        
        const enabledTools = composioMcps.flatMap((mcp: any) => mcp.enabledTools || []);
        console.log('ComposioToolsSelector: Found enabled tools', enabledTools);
        onToolsChange(enabledTools);
      }
    } catch (err) {
      console.error('ComposioToolsSelector: Failed to load current agent tools:', err);
    }
  };

  const handleToolToggle = (toolName: string) => {
    const newTools = selectedTools.includes(toolName)
      ? selectedTools.filter(t => t !== toolName)
      : [...selectedTools, toolName];
    onToolsChange(newTools);
  };

  const handleSelectAll = () => {
    const allToolNames = filteredTools.map(tool => tool.name);
    const hasAll = allToolNames.every(name => selectedTools.includes(name));
    
    if (hasAll) {
      const newTools = selectedTools.filter(name => !allToolNames.includes(name));
      onToolsChange(newTools);
    } else {
      const newTools = [...selectedTools];
      allToolNames.forEach(name => {
        if (!newTools.includes(name)) {
          newTools.push(name);
        }
      });
      onToolsChange(newTools);
    }
  };

  const handleSave = async () => {
    if (!agentId || !onSave) return;
    
    try {
      setIsSaving(true);
      await onSave();
    } catch (error: any) {
      console.error('Failed to save tools:', error);
      toast.error(error.response?.data?.detail || 'Failed to save tools');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = selectedTools.length;
  const filteredSelectedCount = filteredTools.filter(tool => selectedTools.includes(tool.name)).length;
  const allFilteredSelected = filteredTools.length > 0 && filteredSelectedCount === filteredTools.length;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Search and Controls Bar */}
      <div className="px-6 py-3 border-b bg-muted/20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-9 bg-background border-0 focus-visible:ring-1"
            />
          </div>
          
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground whitespace-nowrap">
              {filteredTools.length} {searchTerm && `of ${availableTools.length}`} tools
            </span>
            
            {selectedCount > 0 && (
              <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                {selectedCount}
              </Badge>
            )}
            
            {filteredTools.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="h-8 text-xs"
              >
                {allFilteredSelected ? 'Deselect' : 'Select'} All
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tools List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6">
          {error && (
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ToolSkeleton key={i} />
              ))}
            </div>
          ) : filteredTools.length > 0 ? (
            <div className="space-y-3">
              {filteredTools.map((tool) => (
                <ToolCard
                  key={tool.name}
                  tool={tool}
                  isSelected={selectedTools.includes(tool.name)}
                  onToggle={() => handleToolToggle(tool.name)}
                  searchTerm={searchTerm}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? `No tools found matching "${searchTerm}"` : 'No tools available'}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer with Save Button */}
      {showSaveButton && (
        <div className="p-6 pt-4 border-t bg-muted/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedCount > 0 ? (
                `${selectedCount} tool${selectedCount === 1 ? '' : 's'} will be added to your agent`
              ) : (
                'No tools selected'
              )}
            </div>
            <div className="flex gap-3">
              {onCancel && (
                <Button
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className="min-w-[80px]"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Tools
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
