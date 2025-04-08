import { useState } from "react";
import { Download, Trash2, FileText, Image, File, Loader2, Maximize2, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Attachment } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AttachmentItemProps {
  attachment: Attachment;
  onDelete?: () => void;
}

export function AttachmentItem({ attachment, onDelete }: AttachmentItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const { toast } = useToast();

  const handleDownload = () => {
    // Create a download link for the attachment
    const link = document.createElement('a');
    link.href = `data:${attachment.fileType};base64,${attachment.content}`;
    link.download = attachment.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    
    try {
      await apiRequest("DELETE", `/api/attachments/${attachment.id}`, {});
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      
      // Call the onDelete callback if provided
      if (onDelete) {
        onDelete();
      }
      
      toast({
        title: "Success",
        description: "Attachment deleted",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete attachment",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Determine icon based on file type
  const renderIcon = () => {
    if (attachment.fileType.startsWith('image/')) {
      return <Image className="h-4 w-4 text-indigo-500" />;
    } else if (attachment.fileType.includes('document') || attachment.fileType.includes('pdf')) {
      return <FileText className="h-4 w-4 text-indigo-500" />;
    } else {
      return <File className="h-4 w-4 text-indigo-500" />;
    }
  };
  
  // Create a data URL for attachment content
  const getAttachmentUrl = () => {
    return `data:${attachment.fileType};base64,${attachment.content}`;
  };
  
  // Check if this is an image attachment
  const isImage = attachment.fileType.startsWith('image/');

  return (
    <>
      {isImage ? (
        <div className="rounded-md border border-gray-200 bg-white shadow-sm hover:bg-gray-50 transition-colors group overflow-hidden h-full flex flex-col">
          {/* Square Image Preview */}
          <div 
            className="relative cursor-pointer aspect-square" 
            onClick={() => setShowImagePreview(true)}
          >
            {/* Expand Button */}
            <div className="absolute top-0 left-0 z-10 bg-black/60 text-white px-0.5 py-px text-[8px] rounded-br flex items-center">
              <Maximize2 className="h-2 w-2 mr-0.5" />
              <span>Expand</span>
            </div>
            
            {/* Delete Button - Absolute positioned in top right with slight transparency */}
            <div 
              className="absolute top-0 right-0 z-10 bg-red-500/80 text-white p-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation(); // Prevent opening the preview
                handleDelete();
              }}
              title="Delete attachment"
            >
              {isDeleting ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              ) : (
                <Trash2 className="h-2.5 w-2.5" />
              )}
            </div>
            
            <img 
              src={getAttachmentUrl()} 
              alt={attachment.filename} 
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          
          {/* File Info & Actions - Simplified version to fit in grid */}
          <div className="flex items-center p-1 border-t border-gray-100 mt-auto">
            <div className="h-4 w-4 rounded bg-indigo-50 flex items-center justify-center mr-1 border border-indigo-100">
              {renderIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-medium text-gray-700 truncate">
                {attachment.filename}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0 ml-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
              onClick={(e) => {
                e.stopPropagation(); // Prevent opening the preview
                handleDownload();
              }}
              title="Download"
            >
              <Download className="h-2 w-2" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center rounded-md border border-gray-200 bg-white p-2 shadow-sm hover:bg-gray-50 transition-colors group">
          <div className="h-8 w-8 rounded-md bg-indigo-50 flex items-center justify-center mr-3 border border-indigo-100">
            {renderIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-700 truncate">
              {attachment.filename}
            </div>
            <div className="text-xs text-gray-500">
              AI generated file
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 hover:bg-indigo-50 rounded-full transition-colors"
              onClick={handleDownload}
              title="Download"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              onClick={handleDelete}
              disabled={isDeleting}
              title="Delete"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      )}
      
      {/* Image Preview Dialog */}
      <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
        {/* Use DialogPortal instead of DialogContent to create our own custom version without the default close button */}
        <DialogPortal>
          <DialogOverlay />
          <div 
            className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] gap-0 border bg-background p-0 shadow-lg rounded-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 overflow-hidden"
            aria-labelledby="attachment-preview-title"
            aria-describedby="attachment-preview-description"
          >
            <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
              <h2 id="attachment-preview-title" className="text-lg font-medium text-gray-800">
                {attachment.filename}
              </h2>
              {/* Only one close button */}
              <DialogClose className="w-6 h-6 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
            
            <div className="p-6 flex items-center justify-center bg-black/5">
              {isImage && (
                <img 
                  src={getAttachmentUrl()} 
                  alt={attachment.filename} 
                  className="max-w-full max-h-[70vh] object-contain" 
                />
              )}
            </div>
            
            <div className="p-3 bg-gray-50 flex justify-between border-t">
              <span id="attachment-preview-description" className="text-xs text-gray-500">
                Click outside to close
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="text-xs flex items-center text-blue-600 hover:text-blue-800"
              >
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
            </div>
          </div>
        </DialogPortal>
      </Dialog>
    </>
  );
}
