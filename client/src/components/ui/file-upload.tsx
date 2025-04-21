import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface FileUploadProps {
  cardId: number;
  compact?: boolean;
}

export function FileUpload({ cardId, compact = false }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    console.log("Files selected via click:", files ? files.length : 0);
    
    if (!files || files.length === 0) return;
    
    console.log("Files being uploaded:", Array.from(files).map(f => f.name).join(", "));
    await uploadFiles(Array.from(files));
    // Clear the input so the same files can be uploaded again if needed
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
    
    await uploadFiles(Array.from(files));
  };

  const uploadFiles = async (files: File[]) => {
    setIsUploading(true);
    let response;
    
    try {
      const formData = new FormData();
      
      console.log(`Preparing to upload ${files.length} files:`, files.map(f => 
        `${f.name} (${f.type}, ${Math.round(f.size/1024)}KB)`).join(', '));
      
      // Append each file to the FormData with the 'files' name to match server expectation
      files.forEach(file => {
        formData.append('files', file);
      });
      
      console.log(`Sending upload request to /api/cards/${cardId}/attachments`);
      
      // Use fetch instead of apiRequest because we need to send FormData
      response = await fetch(`/api/cards/${cardId}/attachments`, {
        method: 'POST',
        body: formData,
      });
      
      console.log(`Upload response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        // Try to get error details from the response
        const errorData = await response.json().catch(() => null);
        console.error("Server error response:", errorData);
        
        if (errorData && errorData.message) {
          throw new Error(`Server error: ${errorData.message}`);
        } else {
          throw new Error(`Failed to upload files (Status: ${response.status})`);
        }
      }
      
      // Invalidate queries to refresh the list of attachments
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cards/${cardId}/processing-status`] });
      
      const fileText = files.length > 1 ? 'Files' : 'File';
      toast({
        title: "Success",
        description: `${fileText} uploaded successfully`,
      });
    } catch (error) {
      console.error("Error uploading files:", error);
      
      // Get a more detailed error message
      let errorMessage = "Failed to upload files";
      
      if (error instanceof Error) {
        errorMessage = `Upload failed: ${error.message}`;
        console.log("Error details:", error.stack);
      }
      
      // Try to get more information if it's a response error
      let response;
      try {
        // Try to access the response variable from the outer scope
        response = error instanceof Error && (error as any).response;
        
        if (response && typeof response.json === 'function') {
          const errorResponse = await response.json();
          if (errorResponse && errorResponse.message) {
            errorMessage = `Server error: ${errorResponse.message}`;
            console.log("Server error details:", errorResponse);
          }
        }
      } catch (jsonError) {
        // Ignore JSON parsing errors
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Make the click handler separate from the button click
  const handleButtonClick = (e: React.MouseEvent) => {
    // Stop propagation to prevent event bubbling
    e.stopPropagation(); 
    
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Return compact version when compact prop is true
  if (compact) {
    return (
      <div
        className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs shadow-sm hover:bg-gray-100 transition-colors cursor-pointer"
        onClick={handleButtonClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        title="Upload attachment"
      >
        <input 
          type="file"
          multiple 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          disabled={isUploading}
        />
        
        {isUploading ? (
          <Loader2 className="h-3 w-3 animate-spin text-gray-600" />
        ) : (
          <Paperclip className="h-3 w-3 text-gray-600" />
        )}
      </div>
    );
  }
  
  // Return regular version for grid layout
  return (
    <div 
      className="rounded-md border border-gray-200 bg-white shadow-sm hover:bg-gray-50 transition-colors overflow-hidden h-full flex flex-col"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleButtonClick}
    >
      <input 
        type="file"
        multiple 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        disabled={isUploading}
      />
      
      {/* Square Placeholder */}
      <div 
        className={`relative cursor-pointer aspect-square ${
          isDragging ? 'bg-blue-50' : 'bg-gray-50'
        }`}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {isUploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          ) : (
            <div className="flex flex-col items-center justify-center">
              <Paperclip className="h-6 w-6 text-gray-500 mb-1" />
              <p className="text-[9px] text-center text-gray-500 px-1">
                Select multiple files
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Info Bar */}
      <div className="flex items-center p-1 border-t border-gray-100 mt-auto">
        <div className="h-4 w-4 rounded bg-blue-50 flex items-center justify-center mr-1 border border-blue-100">
          <Paperclip className="h-2 w-2 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-medium text-gray-700 truncate">
            Add attachments
          </div>
        </div>
      </div>
    </div>
  );
}