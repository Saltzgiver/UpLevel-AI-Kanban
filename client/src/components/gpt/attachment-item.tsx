import { useState, useEffect } from "react";
import { Download, Trash2, FileText, Image, File, Loader2, Maximize2, X, ExternalLink, Table } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Attachment } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CSVViewer } from "./csv-viewer";

interface AttachmentItemProps {
  attachment: Attachment;
  onDelete?: () => void;
}

export function AttachmentItem({ attachment, onDelete }: AttachmentItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();
  
  // No need for keyboard event handlers or body style management
  // as the Dialog component handles all of this automatically

  const handleDownload = () => {
    try {
      // For CSV files, use direct API endpoint for better browser compatibility
      const isCSV = attachment.fileType.includes('csv') || attachment.filename.endsWith('.csv');
      
      if (isCSV) {
        console.log("Using server API endpoint for CSV download");
        // Create a direct link to the attachment endpoint
        const link = document.createElement('a');
        link.href = `/api/attachments/${attachment.id}`;
        link.download = attachment.filename;
        link.target = "_blank"; // Open in new tab to ensure proper download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // For other files, use data URL approach
        console.log("Using data URL for file download");
        const link = document.createElement('a');
        link.href = `data:${attachment.fileType};base64,${attachment.content}`;
        link.download = attachment.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Error downloading attachment:", error);
      alert("Error downloading file. Please try again.");
    }
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
    } else if (attachment.fileType.includes('csv') || attachment.filename.endsWith('.csv')) {
      return <Table className="h-4 w-4 text-green-500" />;
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

  // Check if this is a CSV file
  const isCSV = attachment.fileType.includes('csv') || attachment.filename.endsWith('.csv');
  
  // Safely decode base64 content for CSV files
  const getCSVContent = () => {
    try {
      if (!attachment.content) return "";
      
      // Check if content is already in text format
      if (attachment.content.trim().startsWith('id,') || 
          attachment.content.trim().startsWith('name,') ||
          attachment.content.includes('\n') || 
          attachment.content.includes(',')) {
        return attachment.content;
      }
      
      // Try to decode base64 using a safer method
      try {
        // Use a safer approach to decode base64
        const binaryStr = window.atob(attachment.content);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        return new TextDecoder().decode(bytes);
      } catch (decodeError) {
        console.error("Base64 decoding failed:", decodeError);
        return attachment.content;
      }
    } catch (error) {
      console.error("Error processing CSV content:", error);
      return "Error processing CSV content. Please download the file to view its contents.";
    }
  };

  return (
    <>
      {isImage ? (
        <div className="rounded-md border border-gray-200 bg-white shadow-sm hover:bg-gray-50 transition-colors group overflow-hidden h-full flex flex-col">
          {/* Square Image Preview */}
          <div 
            className="relative cursor-pointer aspect-square" 
            onClick={() => setShowPreview(true)}
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
      ) : isCSV ? (
        <div className="rounded-md border border-gray-200 bg-white shadow-sm hover:bg-gray-50 transition-colors group overflow-hidden h-full flex flex-col">
          {/* CSV Preview Area - square with a table-like appearance */}
          <div 
            className="relative cursor-pointer aspect-square bg-gradient-to-br from-green-50 to-green-100 border-b border-gray-100" 
            onClick={() => setShowPreview(true)}
          >
            {/* Expand Button */}
            <div className="absolute top-0 left-0 z-10 bg-black/60 text-white px-0.5 py-px text-[8px] rounded-br flex items-center">
              <Maximize2 className="h-2 w-2 mr-0.5" />
              <span>View CSV</span>
            </div>
            
            {/* Delete Button */}
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
            
            {/* CSV Thumbnail Preview */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-3">
              <Table className="h-8 w-8 text-green-500 mb-1 opacity-50" />
              
              {/* Fake CSV table-like lines */}
              <div className="w-full max-w-[90%] bg-white rounded-sm shadow-sm border border-green-200 p-1">
                <div className="h-1.5 w-full bg-green-200/50 rounded-sm mb-1.5"></div>
                <div className="h-1 w-full bg-green-100/50 rounded-sm mb-1"></div>
                <div className="h-1 w-full bg-green-100/50 rounded-sm mb-1"></div>
                <div className="h-1 w-full bg-green-100/50 rounded-sm"></div>
              </div>
              
              <div className="text-[9px] text-green-700 mt-2 font-medium">
                Click to view data
              </div>
            </div>
          </div>
          
          {/* File Info & Actions - Same as image */}
          <div className="flex items-center p-1 border-t border-gray-100 mt-auto">
            <div className="h-4 w-4 rounded bg-green-50 flex items-center justify-center mr-1 border border-green-100">
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
          <div className="flex-1 min-w-0" onClick={() => setShowPreview(true)} style={{ cursor: 'pointer' }}>
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
      
      {/* Preview Modal for Images and CSV Files using Dialog component */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{attachment.filename}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center bg-black/5 min-h-[300px] p-6">
            {isImage && (
              <img 
                src={getAttachmentUrl()} 
                alt={attachment.filename} 
                className="max-w-full max-h-[70vh] object-contain" 
              />
            )}
            {isCSV && (
              <CSVViewer content={getCSVContent()} maxRows={100} />
            )}
            {!isImage && !isCSV && (
              <div className="text-center p-4">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Preview not available for this file type.</p>
                <p className="text-gray-500 text-sm mt-2">Click the download button to access the file.</p>
              </div>
            )}
          </div>
          <div className="p-3 bg-gray-50 flex justify-between border-t">
            <span className="text-xs text-gray-500">
              Press Escape to close
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
