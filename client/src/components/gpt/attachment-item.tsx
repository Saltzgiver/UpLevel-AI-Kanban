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
}

export function AttachmentItem({ attachment }: AttachmentItemProps) {
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
        <div className="flex flex-col rounded-md border border-gray-200 bg-white shadow-sm hover:bg-gray-50 transition-colors group overflow-hidden">
          {/* Image Preview */}
          <div 
            className="relative cursor-pointer" 
            onClick={() => setShowImagePreview(true)}
          >
            <div className="absolute top-0 left-0 bg-black/60 text-white px-1 py-0.5 text-xs rounded-br flex items-center">
              <Maximize2 className="h-3 w-3 mr-1" />
              <span>Click to expand</span>
            </div>
            <img 
              src={getAttachmentUrl()} 
              alt={attachment.filename} 
              className="w-full h-32 object-cover"
            />
          </div>
          
          {/* File Info & Actions */}
          <div className="flex items-center p-2">
            <div className="h-7 w-7 rounded-md bg-indigo-50 flex items-center justify-center mr-2 border border-indigo-100">
              {renderIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-700 truncate">
                {attachment.filename}
              </div>
              <div className="text-[10px] text-gray-500">
                AI generated image
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-indigo-50 rounded-full"
                onClick={handleDownload}
                title="Download"
              >
                <Download className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                onClick={handleDelete}
                disabled={isDeleting}
                title="Delete"
              >
                {isDeleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </Button>
            </div>
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
              className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 hover:bg-indigo-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleDownload}
              title="Download"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
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
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-4 bg-gray-50">
            <DialogTitle className="flex items-center justify-between">
              <span className="text-gray-800 font-medium">
                {attachment.filename}
              </span>
              <DialogClose className="w-6 h-6 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100">
                <X className="h-4 w-4" />
              </DialogClose>
            </DialogTitle>
          </DialogHeader>
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
            <span className="text-xs text-gray-500">
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
        </DialogContent>
      </Dialog>
    </>
  );
}
