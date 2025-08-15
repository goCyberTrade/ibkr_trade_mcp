import React, { useState, useRef, KeyboardEvent } from 'react';
import { Sparkles, Settings, Download, Image as ImageIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { KortixLogo } from '@/components/sidebar/kortix-logo';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ProfilePictureDialog } from './profile-picture-dialog';
import { AgentVersionSwitcher } from '../agent-version-switcher';
import { UpcomingRunsDropdown } from '../upcoming-runs-dropdown';

interface AgentHeaderProps {
  agentId: string;
  displayData: {
    name: string;
    description?: string;
    profile_image_url?: string;
  };
  activeTab: string;
  isViewingOldVersion: boolean;
  onFieldChange: (field: string, value: any) => void;
  onTabChange: (value: string) => void;
  onExport?: () => void;
  isExporting?: boolean;
  agentMetadata?: {
    is_suna_default?: boolean;
    centrally_managed?: boolean;
    restrictions?: {
      name_editable?: boolean;
    };
  };
  // Version control props
  currentVersionId?: string;
  currentFormData?: {
    system_prompt: string;
    configured_mcps: any[];
    custom_mcps: any[];
    agentpress_tools: any;
  };
  hasUnsavedChanges?: boolean;
  onVersionCreated?: () => void;
  onNameSave?: (name: string) => Promise<void>;
  onProfileImageSave?: (profileImageUrl: string | null) => Promise<void>;
}

export function AgentHeader({
  agentId,
  displayData,
  activeTab,
  isViewingOldVersion,
  onFieldChange,
  onTabChange,
  onExport,
  isExporting = false,
  agentMetadata,
  currentVersionId,
  currentFormData,
  hasUnsavedChanges,
  onVersionCreated,
  onNameSave,
  onProfileImageSave,
}: AgentHeaderProps) {
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(displayData.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSunaAgent = agentMetadata?.is_suna_default || false;
  const restrictions = agentMetadata?.restrictions || {};
  const isNameEditable = !isViewingOldVersion && (restrictions.name_editable !== false);
  
  const startEditing = () => {
    setEditName(displayData.name);
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditName(displayData.name);
  };

  const saveNewName = async () => {
    if (editName.trim() === '') {
      setEditName(displayData.name);
      setIsEditing(false);
      return;
    }

    if (editName !== displayData.name) {
      if (!isNameEditable && isSunaAgent) {
        toast.error("Name cannot be edited", {
          description: "Suna's name is managed centrally and cannot be changed.",
        });
        setEditName(displayData.name);
        setIsEditing(false);
        return;
      }
      
      // Use dedicated save handler if available, otherwise fallback to generic onFieldChange
      if (onNameSave) {
        await onNameSave(editName);
      } else {
        onFieldChange('name', editName);
      }
    }

    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveNewName();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const handleImageUpdate = (url: string | null) => {
    // Use dedicated save handler if available, otherwise fallback to generic onFieldChange
    if (onProfileImageSave) {
      onProfileImageSave(url);
    } else {
      onFieldChange('profile_image_url', url);
    }
  };

  return (
    <>
    <header className="bg-background sticky top-0 flex h-14 shrink-0 items-center gap-3 z-20 w-full px-8 mb-2">
      {/* Left side - Agent info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative flex-shrink-0">
          {isSunaAgent ? (
            <div className="h-9 w-9 rounded-lg bg-muted border flex items-center justify-center">
              <KortixLogo size={16} />
            </div>
          ) : (
            <button 
              className="cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => setIsProfileDialogOpen(true)}
              type="button"
            >
              <Avatar className="h-9 w-9 rounded-lg ring-1 ring-black/5 hover:ring-black/10 transition-colors">
                {displayData.profile_image_url ? (
                  <AvatarImage 
                    src={displayData.profile_image_url} 
                    alt={displayData.name}
                    className="object-cover rounded-lg"
                  />
                ) : (
                  <AvatarFallback className="rounded-lg text-xs hover:bg-muted">
                    <ImageIcon className="h-4 w-4" />
                  </AvatarFallback>
                )}
              </Avatar>
            </button>
          )}
        </div>
        <div className="min-w-0">
          {isEditing ? (
            <Input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={saveNewName}
              className="h-8 w-auto min-w-[180px] text-base font-medium"
              maxLength={50}
            />
          ) : !displayData.name || displayData.name === 'Agent' ? (
            <Skeleton className="h-5 w-32" />
          ) : (
            <div
              className={cn(
                "text-base font-medium text-muted-foreground hover:text-foreground cursor-pointer flex items-center truncate max-w-[300px]",
                !isNameEditable && isSunaAgent && "cursor-not-allowed opacity-75"
              )}
              onClick={isNameEditable ? startEditing : undefined}
              title={isNameEditable ? `Click to rename agent: ${displayData.name}` : `Name cannot be edited: ${displayData.name}`}
            >
              {displayData.name}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 items-center gap-2">
        {/* Spacer to push content to the right */}
      </div>

      {/* Right side - Version controls, tabs and actions aligned together */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {!isSunaAgent && currentFormData && (
            <AgentVersionSwitcher
              agentId={agentId}
              currentVersionId={currentVersionId}
              currentFormData={currentFormData}
            />
          )}
          <UpcomingRunsDropdown agentId={agentId} />
          {onExport && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9"
                    onClick={onExport}
                    disabled={isExporting}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isExporting ? 'Exporting...' : 'Export Agent'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {!isSunaAgent && (
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="grid grid-cols-2 h-9 w-[280px]">
              <TabsTrigger 
                value="agent-builder" 
                className="flex items-center gap-1.5 text-xs px-3"
              >
                <Sparkles className="h-3 w-3" />
                <span className="hidden md:inline">Prompt to build</span>
              </TabsTrigger>
              <TabsTrigger 
                value="configuration" 
                className="flex items-center gap-1.5 text-xs px-3"
              >
                <Settings className="h-3 w-3" />
                <span className="hidden md:inline">Manual config</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>
    </header>
    <ProfilePictureDialog
      isOpen={isProfileDialogOpen}
      onClose={() => setIsProfileDialogOpen(false)}
      currentImageUrl={displayData.profile_image_url}
      agentName={displayData.name}
      onImageUpdate={handleImageUpdate}
    />
    </>
  );
} 