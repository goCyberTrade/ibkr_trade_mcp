import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Presentation,
  Code,
  Eye,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { ToolViewProps } from './types';
import { formatTimestamp, extractToolData } from './utils';
import { cn } from '@/lib/utils';
import { constructHtmlPreviewUrl } from '@/lib/utils/url';
import { CodeBlockCode } from '@/components/ui/code-block';
import { LoadingState } from './shared/LoadingState';
import { useMutation } from '@tanstack/react-query';
import { backendApi } from '@/lib/api-client';
import { useParams } from 'next/navigation';

interface SlideInfo {
  slide_number: number;
  title: string;
  file: string;
  preview_url: string;
}

interface PresentationData {
  message: string;
  presentation_path: string;
  index_file: string;
  slides: SlideInfo[];
  presentation_name?: string;
  title?: string;
  total_slides?: number;
}

interface ExportPresentationRequest {
  presentation_name: string;
  format: string;
  project_id: string;
}

interface ExportPresentationResponse {
  success: boolean;
  message: string;
  download_url?: string;
  file_content?: string;
  filename?: string;
  export_file: string;
  format: string;
  file_size: number;
}

export function PresentationToolView({
  assistantContent,
  toolContent,
  assistantTimestamp,
  toolTimestamp,
  isSuccess = true,
  isStreaming = false,
  name,
  project,
}: ToolViewProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideContents, setSlideContents] = useState<Record<string, string>>({});
  const [loadingSlides, setLoadingSlides] = useState<Set<string>>(new Set());
  const params = useParams();
  const projectId = params.projectId as string;
  console.log('Project ID:', projectId);

  const exportMutation = useMutation<ExportPresentationResponse, Error, ExportPresentationRequest>({
    mutationFn: async (request) => {
      const response = await backendApi.post('/tools/export-presentation', request);
      if (!response.success) {
        throw new Error(response.error?.message || 'Export failed');
      }
      return response.data;
    },
    onSuccess: async (data) => {
      try {
        let blob: Blob;
        let filename: string;

        if (data.file_content) {
          const binaryString = atob(data.file_content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
          filename = data.filename || `${data.export_file.split('/').pop()}`;
        } else if (data.download_url) {
          const response = await fetch(data.download_url);
          if (!response.ok) {
            throw new Error(`Download failed: ${response.statusText}`);
          }
          blob = await response.blob();
          filename = `${data.export_file.split('/').pop()}`;
        } else {
          throw new Error('No download method available');
        }
        
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error('Download error:', error);
      }
    },
    onError: (error) => {
      console.error('Export error:', error);
    },
  });

  const { toolResult } = extractToolData(toolContent);
  
  let presentationData: PresentationData | null = null;
  let error: string | null = null;

  try {
    if (toolResult && toolResult.toolOutput) {
      const output = toolResult.toolOutput;
      if (typeof output === 'string') {
        try {
          presentationData = JSON.parse(output);
        } catch (e) {
          console.error('Failed to parse tool output:', e);
          error = 'Failed to parse presentation data';
        }
      } else {
        presentationData = output as unknown as PresentationData;
      }
    }
  } catch (e) {
    console.error('Error parsing presentation data:', e);
    error = 'Failed to parse presentation data';
  }

  const loadSlideContent = async (slidePath: string) => {
    if (slideContents[slidePath] || loadingSlides.has(slidePath)) {
      return;
    }

    setLoadingSlides(prev => new Set([...prev, slidePath]));

    try {
      const fullUrl = constructHtmlPreviewUrl(project?.sandbox?.sandbox_url, slidePath);
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error(`Failed to load slide: ${response.statusText}`);
      }
      
      const content = await response.text();
      setSlideContents(prev => ({ ...prev, [slidePath]: content }));
    } catch (error) {
      console.error('Failed to load slide content:', error);
    } finally {
      setLoadingSlides(prev => {
        const newSet = new Set(prev);
        newSet.delete(slidePath);
        return newSet;
      });
    }
  };

  const currentSlide = presentationData?.slides[currentSlideIndex];
  const slideContent = currentSlide ? slideContents[currentSlide.file] : null;

  if (currentSlide && !slideContent && !loadingSlides.has(currentSlide.file)) {
    loadSlideContent(currentSlide.file);
  }

  const navigateSlide = (direction: 'prev' | 'next') => {
    if (!presentationData) return;
    if (direction === 'prev' && currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    } else if (direction === 'next' && currentSlideIndex < presentationData.slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };

  const handleExportPPTX = () => {
    if(!presentationData?.presentation_name || !projectId) {
      return;
    }
    exportMutation.mutate({
      presentation_name: presentationData.presentation_name,
      format: 'pptx',
      project_id: projectId
    });
  };

  const renderSlidePreview = () => {
    if (!currentSlide) return null;

    if (loadingSlides.has(currentSlide.file) || !slideContent) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    return (
      <div className="w-full h-full aspect-[16/9] flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-lg">
        <div className="w-full h-full bg-white dark:bg-zinc-900 rounded-lg overflow-hidden shadow-lg">
          <iframe
            srcDoc={slideContent}
            className="w-full h-full border-0"
            title={`Slide ${currentSlide.slide_number}: ${currentSlide.title}`}
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    );
  };

  const renderSlideCode = () => {
    if (!currentSlide) return null;

    if (loadingSlides.has(currentSlide.file) || !slideContent) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    return (
      <CodeBlockCode
        code={slideContent}
        language="html"
        className="text-xs"
      />
    );
  };

  return (
    <Card className="gap-0 flex border shadow-none border-t border-b-0 border-x-0 p-0 rounded-none flex-col h-full overflow-hidden bg-card">
      <CardHeader className="h-14 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b p-2 px-4 space-y-2">
        <div className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20">
              <Presentation className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                {presentationData?.title || 'Presentation'}
              </CardTitle>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isStreaming && !error && presentationData && (
              <Badge
                variant="secondary"
                className="bg-gradient-to-b from-emerald-200 to-emerald-100 text-emerald-700 dark:from-emerald-800/50 dark:to-emerald-900/60 dark:text-emerald-300"
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Success
              </Badge>
            )}
            {!isStreaming && (error || !isSuccess) && (
              <Badge
                variant="secondary"
                className="bg-gradient-to-b from-rose-200 to-rose-100 text-rose-700 dark:from-rose-800/50 dark:to-rose-900/60 dark:text-rose-300"
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                Presentation creation failed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 h-full flex-1 overflow-hidden relative">
        {isStreaming ? (
          <LoadingState
            icon={Presentation}
            iconColor="text-blue-500 dark:text-blue-400"
            bgColor="bg-gradient-to-b from-blue-100 to-blue-50 shadow-inner dark:from-blue-800/40 dark:to-blue-900/60 dark:shadow-blue-950/20"
            title="Creating presentation"
            filePath="Generating slides..."
            showProgress={true}
          />
        ) : error || !presentationData ? (
          <div className="flex flex-col items-center justify-center h-full py-12 px-6 bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-950 dark:to-zinc-900">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-gradient-to-b from-rose-100 to-rose-50 shadow-inner dark:from-rose-800/40 dark:to-rose-900/60">
              <AlertTriangle className="h-10 w-10 text-rose-400 dark:text-rose-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
              {error || 'Failed to create presentation'}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-md">
              There was an error creating the presentation. Please try again.
            </p>
          </div>
        ) : (
          <Tabs defaultValue="preview" className="w-full h-full flex flex-col">
            <div className="px-4 py-3 border-b bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateSlide('prev')}
                    disabled={currentSlideIndex === 0}
                    className="h-7"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-2 px-3">
                    <span className="text-sm font-medium">
                      Slide {currentSlideIndex + 1} of {presentationData.slides.length}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateSlide('next')}
                    disabled={currentSlideIndex === presentationData.slides.length - 1}
                    className="h-7"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 h-7 text-xs"
                    onClick={handleExportPPTX}
                    disabled={exportMutation.isPending || !presentationData?.presentation_name}
                    title={exportMutation.isPending ? "Exporting..." : "Download as PPTX"}
                  >
                    {exportMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    {exportMutation.isPending ? "Exporting..." : "PPTX"}
                  </Button>
                  <TabsList className="h-8 bg-muted/50 border border-border/50 p-0.5 gap-1">
                    <TabsTrigger
                        value="preview"
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all [&[data-state=active]]:bg-white [&[data-state=active]]:dark:bg-primary/10 [&[data-state=active]]:text-foreground hover:bg-background/50 text-muted-foreground shadow-none"
                    >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                    </TabsTrigger>
                    <TabsTrigger
                        value="code"
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-all [&[data-state=active]]:bg-white [&[data-state=active]]:dark:bg-primary/10 [&[data-state=active]]:text-foreground hover:bg-background/50 text-muted-foreground shadow-none"
                    >
                        <Code className="h-3.5 w-3.5" />
                        Code
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <ScrollArea className="w-full h-12">
                  <div className="flex gap-2 p-1">
                    {presentationData.slides.map((slide, index) => (
                      <button
                        key={slide.slide_number}
                        onClick={() => setCurrentSlideIndex(index)}
                        className={cn(
                          "flex-shrink-0 w-16 h-10 rounded-lg border transition-all overflow-hidden",
                          "hover:border-primary/50",
                          index === currentSlideIndex
                            ? "border-primary shadow-sm"
                            : "border-border"
                        )}
                      >
                        <div className="w-full h-full bg-muted border rounded-lg flex items-center justify-center">
                          <span className="text-white text-xs font-medium">{index + 1}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="preview" className="h-full mt-0">
                <div className="h-full rounded-lg border bg-muted/20">
                  {renderSlidePreview()}
                </div>
              </TabsContent>

              <TabsContent value="code" className="h-full mt-0 p-0">
                <ScrollArea className="h-full">
                  <div className="p-4">
                    {renderSlideCode()}
                  </div>
                </ScrollArea>
              </TabsContent>
            </div>
          </Tabs>
        )}
      </CardContent>

      <div className="px-4 py-2 h-10 bg-gradient-to-r from-zinc-50/90 to-zinc-100/90 dark:from-zinc-900/90 dark:to-zinc-800/90 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center gap-4">
        <div className="h-full flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          {!isStreaming && presentationData && (
            <Badge variant="outline" className="h-6 py-0.5 bg-zinc-50 dark:bg-zinc-900">
              {presentationData.slides.length} slides
            </Badge>
          )}
        </div>
        <div className="h-full flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
          <Clock className="h-3 w-3" />
          <span>
            {formatTimestamp(toolTimestamp)}
          </span>
        </div>
      </div>
    </Card>
  );
} 