import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface FileUploadProps {
  cardId: number;
}

export function FileUpload({ cardId }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    await uploadFile(files[0]);
    // Clear the input so the same file can be uploaded again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    
    await uploadFile(files[0]);
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Use fetch instead of apiRequest because we need to send FormData
      const response = await fetch(`/api/cards/${cardId}/attachments`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload file');
      }
      
      // Invalidate queries to refresh the list of attachments
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cards/${cardId}/processing-status`] });
      
      toast({
        title: "Success",
        description: "File uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="mt-2">
      <div 
        className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-colors ${
          isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleButtonClick}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          disabled={isUploading}
        />
        {isUploading ? (
          <div className="flex flex-col items-center justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500 mb-1" />
            <p className="text-xs text-gray-500">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-2">
            <Upload className="h-5 w-5 text-blue-500 mb-1" />
            <p className="text-xs text-gray-500">
              Drag & drop a file or click to browse
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Supported files: images, PDFs, CSVs, etc.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}