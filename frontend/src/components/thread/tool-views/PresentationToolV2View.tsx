import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  FileText,
  Presentation,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { ToolViewProps } from './types';
import { formatTimestamp, extractToolData, getToolTitle } from './utils';
import { cn } from '@/lib/utils';
import { LoadingState } from './shared/LoadingState';
import { useMutation } from '@tanstack/react-query';
import { backendApi } from '@/lib/api-client';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

interface PresentationData {
  version: string;
  metadata: {
    title: string;
    subtitle?: string;
    theme: string;
    created_at: string;
    presentation_name: string;
    total_slides: number;
  };
  slides: Array<{
    layout: string;
    content: any;
  }>;
  theme_config: {
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
      text_light: string;
    };
    fonts: {
      heading: string;
      body: string;
    };
  };
}

interface SlideInfo {
  slide_number: number;
  layout: string;
  title: string;
}

interface PresentationResult {
  message: string;
  presentation_name: string;
  json_file: string;
  preview_url: string;
  total_slides: number;
  theme: string;
  slides: SlideInfo[];
}

export function PresentationToolV2View({
  assistantContent,
  toolContent,
  assistantTimestamp,
  toolTimestamp,
  isSuccess = true,
  isStreaming = false,
  name = 'create-presentation',
  project,
}: ToolViewProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [presentationData, setPresentationData] = useState<PresentationData | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const params = useParams();
  const projectId = params.projectId as string;

  const toolTitle = getToolTitle(name);
  const { toolResult } = extractToolData(toolContent);

  // Parse the presentation result
  let presentationResult: PresentationResult | null = null;
  let error: string | null = null;

  try {
    if (toolResult && toolResult.toolOutput) {
      const output = toolResult.toolOutput;
      if (typeof output === 'string') {
        try {
          presentationResult = JSON.parse(output);
        } catch (e: any) {
          console.error('Failed to parse tool output:', e);
          error = e?.message || 'Failed to parse presentation data';
        }
      } else {
        presentationResult = output as unknown as PresentationResult;
      }
    }
  } catch (e: any) {
    console.error('Error parsing presentation data:', e);
    error = e?.message || 'Failed to parse presentation data';
  }

  // Load the full presentation JSON data
  useEffect(() => {
    if (presentationResult?.json_file && project?.sandbox?.sandbox_url) {
      const loadPresentationData = async () => {
        try {
          const url = `${project.sandbox.sandbox_url}/workspace/${presentationResult.json_file}`;
          const response = await fetch(url);
          if (!response.ok) throw new Error('Failed to load presentation data');
          const data = await response.json();
          setPresentationData(data);
        } catch (err: any) {
          console.error('Error loading presentation:', err);
        }
      };
      loadPresentationData();
    }
  }, [presentationResult, project]);

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!presentationResult?.presentation_name) {
        // Create a plain object instead of Error to avoid read-only property issues
        return Promise.reject({ message: 'No presentation name available' });
      }

      const response = await backendApi.post('/tools/export-presentation', {
        presentation_name: presentationResult.presentation_name,
        format: 'pptx',
        project_id: projectId,
      });

      if (!response.success) {
        const errorMessage = typeof response.error === 'string' 
          ? response.error 
          : response.error?.message || 'Export failed';
        // Use Promise.reject with plain object instead of throwing Error
        return Promise.reject({ message: errorMessage });
      }

      return response.data;
    },
    onSuccess: (data) => {
      if (data.file_content) {
        // Create a download link
        const binaryString = atob(data.file_content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename || 'presentation.pptx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Presentation exported successfully!');
      }
    },
    onError: (error: any) => {
      console.error('Export error:', error);
      let errorMessage = 'Export failed';
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = error.message || error.toString() || 'Export failed';
      }
      toast.error(`Export failed: ${errorMessage}`);
    },
  });

  if (isStreaming) {
    return <LoadingState title="Creating presentation..." />;
  }

  if (error || !isSuccess) {
    return (
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <CardTitle className="text-base">Presentation Creation Failed</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error || 'Failed to create presentation'}</p>
        </CardContent>
      </Card>
    );
  }

  if (!presentationResult) {
    return <LoadingState title="Loading presentation..." />;
  }

  const currentSlide = presentationData?.slides[currentSlideIndex];
  const theme = presentationData?.theme_config;

  const navigateSlide = (direction: 'prev' | 'next') => {
    if (!presentationData) return;
    
    if (direction === 'prev' && currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    } else if (direction === 'next' && currentSlideIndex < presentationData.slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };

  const renderSlide = () => {
    if (!currentSlide || !theme) return null;

    const { layout, content } = currentSlide;
    const { colors, fonts } = theme;

    const slideStyle = {
      backgroundColor: colors.background,
      color: colors.text,
      fontFamily: fonts.body,
    };

    switch (layout) {
      case 'title':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center" style={slideStyle}>
            <h1
              className="text-6xl font-bold mb-6"
              style={{ color: colors.primary, fontFamily: fonts.heading }}
            >
              {content.title}
            </h1>
            {content.subtitle && (
              <p className="text-3xl" style={{ color: colors.secondary }}>
                {content.subtitle}
              </p>
            )}
          </div>
        );

      case 'title-bullets':
        return (
          <div className="flex flex-col h-full p-12" style={slideStyle}>
            <h2
              className="text-5xl font-bold mb-8"
              style={{ color: colors.primary, fontFamily: fonts.heading }}
            >
              {content.title}
            </h2>
            <ul className="space-y-4 text-2xl">
              {content.bullets?.map((bullet: string, i: number) => (
                <li key={i} className="flex items-start">
                  <span className="mr-3" style={{ color: colors.accent }}>
                    ▸
                  </span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        );

      case 'two-column':
        return (
          <div className="flex flex-col h-full p-12" style={slideStyle}>
            <h2
              className="text-5xl font-bold mb-8"
              style={{ color: colors.primary, fontFamily: fonts.heading }}
            >
              {content.title}
            </h2>
            <div className="grid grid-cols-2 gap-12 flex-1">
              <div>
                {content.left_content?.subtitle && (
                  <h3 className="text-3xl font-semibold mb-4" style={{ color: colors.secondary }}>
                    {content.left_content.subtitle}
                  </h3>
                )}
                {content.left_content?.bullets && (
                  <ul className="space-y-3 text-xl">
                    {content.left_content.bullets.map((bullet: string, i: number) => (
                      <li key={i} className="flex items-start">
                        <span className="mr-2" style={{ color: colors.accent }}>
                          ▸
                        </span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                {content.right_content?.subtitle && (
                  <h3 className="text-3xl font-semibold mb-4" style={{ color: colors.secondary }}>
                    {content.right_content.subtitle}
                  </h3>
                )}
                {content.right_content?.bullets && (
                  <ul className="space-y-3 text-xl">
                    {content.right_content.bullets.map((bullet: string, i: number) => (
                      <li key={i} className="flex items-start">
                        <span className="mr-2" style={{ color: colors.accent }}>
                          ▸
                        </span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        );

      case 'quote':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center px-16" style={slideStyle}>
            <blockquote
              className="text-4xl italic mb-6 leading-relaxed"
              style={{ color: colors.primary }}
            >
              "{content.quote}"
            </blockquote>
            {content.author && (
              <p className="text-2xl" style={{ color: colors.secondary }}>
                — {content.author}
              </p>
            )}
          </div>
        );

      case 'section':
        return (
          <div
            className="flex flex-col items-center justify-center h-full text-center"
            style={{ backgroundColor: colors.primary, color: colors.background }}
          >
            <h1 className="text-7xl font-bold mb-6" style={{ fontFamily: fonts.heading }}>
              {content.title}
            </h1>
            {content.subtitle && <p className="text-3xl opacity-90">{content.subtitle}</p>}
          </div>
        );

      case 'title-content':
        return (
          <div className="flex flex-col h-full p-12" style={slideStyle}>
            <h2
              className="text-5xl font-bold mb-8"
              style={{ color: colors.primary, fontFamily: fonts.heading }}
            >
              {content.title}
            </h2>
            <p className="text-2xl leading-relaxed">{content.text}</p>
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full" style={slideStyle}>
            <p className="text-gray-500">Blank slide</p>
          </div>
        );
    }
  };

  return (
    <Card className={cn(
      "flex border shadow-none border-t border-b-0 border-x-0 p-0 rounded-none flex-col h-full overflow-hidden bg-card",
      isFullscreen && 'fixed inset-0 z-50 rounded-none'
    )}>
      <CardHeader className="h-14 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b p-2 px-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative p-2 rounded-lg border bg-gradient-to-br from-violet-500/20 to-violet-600/10 border-violet-500/20">
              <Presentation className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-base font-medium text-zinc-900 dark:text-zinc-100">
                {toolTitle}
              </CardTitle>
            </div>
            <Badge variant="secondary" className="ml-2">{presentationData?.metadata.theme || presentationResult.theme}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 text-xs bg-white dark:bg-muted/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-none"
            >
              <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
              {isFullscreen ? 'Exit' : 'Fullscreen'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (presentationResult?.preview_url && project?.sandbox?.sandbox_url) {
                  window.open(
                    `${project.sandbox.sandbox_url}${presentationResult.preview_url}`,
                    '_blank'
                  );
                }
              }}
              className="h-8 text-xs bg-white dark:bg-muted/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-none"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Preview
            </Button>
            <Button
              size="sm"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
              className="h-8 text-xs bg-white dark:bg-muted/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-none"
            >
              {exportMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5" />
              )}
              Export PPTX
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1">
        <div className={cn('relative', isFullscreen ? 'h-screen' : 'h-[500px]')}>
          {/* Slide viewer */}
          <div className="absolute inset-0 bg-gray-100 dark:bg-gray-900">
            {presentationData ? (
              <div className="w-full h-full flex items-center justify-center p-4">
                <div
                  className="w-full h-full max-w-5xl rounded-lg shadow-xl"
                  style={{ aspectRatio: '16/9' }}
                >
                  {renderSlide()}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
          </div>

          {/* Navigation controls */}
          {presentationData && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-white dark:bg-gray-800 rounded-full px-4 py-2 shadow-lg">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigateSlide('prev')}
                disabled={currentSlideIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">
                {currentSlideIndex + 1} / {presentationData.slides.length}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigateSlide('next')}
                disabled={currentSlideIndex === presentationData.slides.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Slide thumbnails */}
          {presentationData && !isFullscreen && (
            <div className="absolute right-4 top-4 bottom-4 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 overflow-y-auto">
              <div className="space-y-2">
                {presentationResult.slides.map((slide, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlideIndex(index)}
                    className={cn(
                      'w-full text-left p-2 rounded-md transition-colors',
                      currentSlideIndex === index
                        ? 'bg-blue-100 dark:bg-blue-900'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                  >
                    <div className="text-xs font-medium">Slide {slide.slide_number}</div>
                    <div className="text-xs text-gray-500 truncate">{slide.title}</div>
                    <div className="text-xs text-gray-400">{slide.layout}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 