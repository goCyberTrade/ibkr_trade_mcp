import React, { useState } from 'react';
import {
  FileDiff,
  CheckCircle,
  AlertTriangle,
  Loader2,
  File,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  extractFileEditData,
  generateLineDiff,
  calculateDiffStats,
  LineDiff,
  DiffStats
} from './_utils';
import { formatTimestamp, getToolTitle } from '../utils';
import { ToolViewProps } from '../types';
import { LoadingState } from '../shared/LoadingState';
import ReactDiffViewer from 'react-diff-viewer-continued';

const UnifiedDiffView: React.FC<{ oldCode: string; newCode: string }> = ({ oldCode, newCode }) => (
  <ReactDiffViewer
    oldValue={oldCode}
    newValue={newCode}
    splitView={false}
    hideLineNumbers={true}
    useDarkTheme={document.documentElement.classList.contains('dark')}
    styles={{
      variables: {
        dark: {
          diffViewerColor: '#e2e8f0',
          diffViewerBackground: '#09090b',
          addedBackground: '#104a32',
          addedColor: '#6ee7b7',
          removedBackground: '#5c1a2e',
          removedColor: '#fca5a5',
        },
      },
      diffContainer: {
        backgroundColor: 'var(--card)',
        border: 'none',
      },
      diffRemoved: {
        display: 'none',
      },
      line: {
        fontFamily: 'monospace',
      },
    }}
  />
);

const SplitDiffView: React.FC<{ oldCode: string; newCode: string }> = ({ oldCode, newCode }) => (
  <ReactDiffViewer
    oldValue={oldCode}
    newValue={newCode}
    splitView={true}
    useDarkTheme={document.documentElement.classList.contains('dark')}
    styles={{
      variables: {
        dark: {
          diffViewerColor: '#e2e8f0',
          diffViewerBackground: '#09090b',
          addedBackground: '#104a32',
          addedColor: '#6ee7b7',
          removedBackground: '#5c1a2e',
          removedColor: '#fca5a5',
        },
      },
      diffContainer: {
        backgroundColor: 'var(--card)',
        border: 'none',
      },
      gutter: {
        backgroundColor: 'var(--muted)',
        '&:hover': {
          backgroundColor: 'var(--accent)',
        },
      },
      line: {
        fontFamily: 'monospace',
      },
    }}
  />
);

const ErrorState: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center h-full py-12 px-6 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
    <div className="text-center w-full max-w-xs">
      <AlertTriangle className="h-16 w-16 mx-auto mb-6 text-amber-500" />
      <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
        Invalid File Edit
      </h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {message || "Could not extract the file changes from the tool result."}
      </p>
    </div>
  </div>
);

export function FileEditToolView({
  name = 'edit-file',
  assistantContent,
  toolContent,
  assistantTimestamp,
  toolTimestamp,
  isSuccess = true,
  isStreaming = false,
}: ToolViewProps): JSX.Element {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');

  const {
    filePath,
    originalContent,
    updatedContent,
    actualIsSuccess,
    actualToolTimestamp,
    errorMessage,
  } = extractFileEditData(
    assistantContent,
    toolContent,
    isSuccess,
    toolTimestamp,
    assistantTimestamp
  );

  const toolTitle = getToolTitle(name);

  const lineDiff = originalContent && updatedContent ? generateLineDiff(originalContent, updatedContent) : [];
  const stats: DiffStats = calculateDiffStats(lineDiff);

  const shouldShowError = !isStreaming && (!actualIsSuccess || (actualIsSuccess && (originalContent === null || updatedContent === null)));

  return (
    <Card className="gap-0 flex border shadow-none border-t border-b-0 border-x-0 p-0 rounded-none flex-col h-full bg-card">
      <CardHeader className="h-14 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b p-2 px-4 space-y-2">
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20">
              <FileDiff className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            </div>
            <CardTitle className="text-base font-medium text-zinc-900 dark:text-zinc-100">
              {toolTitle}
            </CardTitle>
          </div>

          {!isStreaming && (
            <Badge
              variant="secondary"
              className={
                actualIsSuccess
                  ? "bg-gradient-to-b from-emerald-200 to-emerald-100 text-emerald-700 dark:from-emerald-800/50 dark:to-emerald-900/60 dark:text-emerald-300"
                  : "bg-gradient-to-b from-rose-200 to-rose-100 text-rose-700 dark:from-rose-800/50 dark:to-rose-900/60 dark:text-rose-300"
              }
            >
              {actualIsSuccess ? (
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
              )}
              {actualIsSuccess ? 'Edit applied' : 'Edit failed'}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col min-h-0">
        {isStreaming ? (
          <LoadingState
            icon={FileDiff}
            iconColor="text-blue-500 dark:text-blue-400"
            bgColor="bg-gradient-to-b from-blue-100 to-blue-50 shadow-inner dark:from-blue-800/40 dark:to-blue-900/60 dark:shadow-blue-950/20"
            title="Applying File Edit"
            filePath={filePath || 'Processing file...'}
            progressText="Analyzing changes"
            subtitle="Please wait while the file is being modified"
          />
        ) : shouldShowError ? (
          <ErrorState message={errorMessage} />
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="shrink-0 p-3 border-b border-zinc-200 dark:border-zinc-800 bg-accent flex items-center justify-between">
              <div className="flex items-center">
                <File className="h-4 w-4 mr-2 text-zinc-500 dark:text-zinc-400" />
                <code className="text-sm font-mono text-zinc-700 dark:text-zinc-300">
                  {filePath || 'Unknown file'}
                </code>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center text-xs text-zinc-500 dark:text-zinc-400 gap-3">
                  {stats.additions === 0 && stats.deletions === 0 ? (
                    <Badge variant="outline" className="text-xs font-normal">No changes</Badge>
                  ) : (
                    <>
                      <div className="flex items-center">
                        <Plus className="h-3.5 w-3.5 text-emerald-500 mr-1" />
                        <span>{stats.additions}</span>
                      </div>
                      <div className="flex items-center">
                        <Minus className="h-3.5 w-3.5 text-red-500 mr-1" />
                        <span>{stats.deletions}</span>
                      </div>
                    </>
                  )}
                </div>
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'unified' | 'split')} className="w-auto">
                  <TabsList className="h-7 p-0.5">
                    <TabsTrigger value="unified" className="text-xs h-6 px-2">Unified</TabsTrigger>
                    <TabsTrigger value="split" className="text-xs h-6 px-2">Split</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
            <div className="flex-1 overflow-auto min-h-0 text-xs">
              {viewMode === 'unified' ? (
                <UnifiedDiffView oldCode={originalContent!} newCode={updatedContent!} />
              ) : (
                <SplitDiffView oldCode={originalContent!} newCode={updatedContent!} />
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}