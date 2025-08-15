'use client';

import React, { useState } from 'react';
import { Upload, Link2, X, Image as ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface ProfilePictureDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentImageUrl?: string;
  agentName: string;
  onImageUpdate: (url: string | null) => void;
}

export function ProfilePictureDialog({
  isOpen,
  onClose,
  currentImageUrl,
  agentName,
  onImageUpdate,
}: ProfilePictureDialogProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isUrlSubmitting, setIsUrlSubmitting] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('You must be logged in to upload images');
        return;
      }
      
      const form = new FormData();
      form.append('file', file);
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/agents/profile-image/upload`, {
        method: 'POST',
        body: form,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      });
      
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(error.message || 'Upload failed');
      }
      
      const data = await res.json();
      if (data?.url) {
        onImageUpdate(data.url);
        toast.success('Profile image uploaded successfully!');
        onClose();
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset input
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleUrlSubmit = async () => {
    if (!customUrl.trim()) {
      toast.error('Please enter a valid URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(customUrl);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    setIsUrlSubmitting(true);
    try {
      onImageUpdate(customUrl);
      toast.success('Profile image URL updated successfully!');
      onClose();
    } catch (err) {
      toast.error('Failed to update profile image URL');
    } finally {
      setIsUrlSubmitting(false);
    }
  };

  const handleUrlPreview = () => {
    if (customUrl) {
      try {
        new URL(customUrl);
        setPreviewUrl(customUrl);
      } catch {
        toast.error('Please enter a valid URL');
      }
    }
  };

  const handleRemoveImage = () => {
    onImageUpdate(null);
    toast.success('Profile image removed');
    onClose();
  };

  const handleClose = () => {
    setCustomUrl('');
    setPreviewUrl(null);
    setDragActive(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-center">Profile Picture</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Current Image Display */}
          <div className="flex justify-center">
            <Avatar className="h-24 w-24 rounded-xl ring-2 ring-border">
              {currentImageUrl ? (
                <AvatarImage 
                  src={currentImageUrl} 
                  alt={agentName}
                  className="object-cover w-full h-full"
                />
              ) : (
                <AvatarFallback className="rounded-xl bg-muted">
                  <ImageIcon className="h-10 w-10 text-muted-foreground" />
                </AvatarFallback>
              )}
            </Avatar>
          </div>

          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="upload" className="text-sm">
                Upload
              </TabsTrigger>
              <TabsTrigger value="url" className="text-sm">
                URL
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="upload" className="mt-4">
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
                  dragActive 
                    ? 'border-primary bg-primary/5 scale-[1.02]' 
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/25'
                } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !isUploading && document.getElementById('file-upload')?.click()}
              >
                <Upload className={`mx-auto h-8 w-8 mb-3 transition-colors ${
                  dragActive ? 'text-primary' : 'text-muted-foreground'
                }`} />
                <p className="text-sm font-medium mb-1">
                  {isUploading ? 'Uploading...' : 'Drop image here or click to select'}
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, GIF up to 5MB
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="file-upload"
                  disabled={isUploading}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="url" className="mt-4 space-y-4">
              <div className="space-y-3">
                <Input
                  type="url"
                  placeholder="Paste image URL here..."
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  onBlur={handleUrlPreview}
                  className="text-sm"
                />
                
                {previewUrl && (
                  <div className="flex justify-center p-3 bg-muted/30 rounded-lg">
                    <Avatar className="h-12 w-12 rounded-lg">
                      <AvatarImage 
                        src={previewUrl} 
                        alt="Preview"
                        className="object-cover w-full h-full"
                        onError={() => {
                          setPreviewUrl(null);
                          toast.error('Unable to load image from URL');
                        }}
                      />
                      <AvatarFallback className="rounded-lg">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
                
                <Button 
                  onClick={handleUrlSubmit}
                  disabled={!customUrl.trim() || isUrlSubmitting}
                  className="w-full"
                  size="sm"
                >
                  {isUrlSubmitting ? 'Updating...' : 'Set as Profile Picture'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
          
          {/* Action Buttons */}
          <div className="flex justify-between pt-2">
            {currentImageUrl ? (
              <Button 
                variant="ghost" 
                onClick={handleRemoveImage}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                size="sm"
              >
                Remove
              </Button>
            ) : (
              <div />
            )}
            <Button variant="outline" onClick={handleClose} size="sm">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 