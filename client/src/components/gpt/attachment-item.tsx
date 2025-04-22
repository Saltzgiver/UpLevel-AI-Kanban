import { useState } from "react";
import { 
  Download, Trash2, FileText, Image, File, Loader2, Maximize2, Table,
  Folder, Link as LinkIcon, Ticket
} from "lucide-react";
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
  
  // Check if this is an image attachment
  const isImage = attachment.fileType.startsWith('image/');

  // Check if this is a CSV file
  const isCSV = attachment.fileType.includes('csv') || attachment.filename.endsWith('.csv');

  const handleDownload = () => {
    try {
      // For CSV files, use direct API endpoint for better browser compatibility
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
    // Images
    if (attachment.fileType.startsWith('image/')) {
      return <Image className="h-4 w-4 text-blue-500" />;
    } 
    // Documents (PDF, Word, etc.)
    else if (attachment.fileType.includes('document') || 
             attachment.fileType.includes('pdf') || 
             attachment.filename.endsWith('.pdf') ||
             attachment.filename.endsWith('.doc') ||
             attachment.filename.endsWith('.docx')) {
      return <FileText className="h-4 w-4 text-indigo-500" />;
    } 
    // Spreadsheets (CSV, Excel)
    else if (attachment.fileType.includes('csv') || 
             attachment.filename.endsWith('.csv') ||
             attachment.filename.endsWith('.xlsx') ||
             attachment.filename.endsWith('.xls')) {
      return <Table className="h-4 w-4 text-green-500" />;
    }
    // Folders
    else if (attachment.fileType.includes('folder') || 
             attachment.filename.includes('folder')) {
      return <Folder className="h-4 w-4 text-orange-500" />;
    }
    // Links
    else if (attachment.fileType.includes('url') || 
             attachment.filename.startsWith('http') ||
             attachment.filename.includes('link')) {
      return <LinkIcon className="h-4 w-4 text-gray-500" />;
    }
    // Tickets or Issues
    else if (attachment.filename.includes('ticket') || 
             attachment.filename.includes('issue')) {
      return <Ticket className="h-4 w-4 text-purple-500" />;
    }
    // Default - generic file
    else {
      return <File className="h-4 w-4 text-blue-500" />;
    }
  };
  
  // Create a data URL for attachment content
  const getAttachmentUrl = () => {
    return `data:${attachment.fileType};base64,${attachment.content}`;
  };
  
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

  // Function to determine the background color based on file type
  const getIconBackground = () => {
    // Images
    if (attachment.fileType.startsWith('image/')) {
      return 'bg-blue-50';
    }
    // Documents
    else if (attachment.fileType.includes('document') || 
             attachment.fileType.includes('pdf') || 
             attachment.filename.endsWith('.pdf') ||
             attachment.filename.endsWith('.doc') ||
             attachment.filename.endsWith('.docx')) {
      return 'bg-indigo-50';
    }
    // Spreadsheets
    else if (attachment.fileType.includes('csv') || 
             attachment.filename.endsWith('.csv') ||
             attachment.filename.endsWith('.xlsx') ||
             attachment.filename.endsWith('.xls')) {
      return 'bg-green-50';
    }
    // Folders
    else if (attachment.fileType.includes('folder') || 
             attachment.filename.includes('folder')) {
      return 'bg-orange-50';
    }
    // Links
    else if (attachment.fileType.includes('url') || 
             attachment.filename.startsWith('http') ||
             attachment.filename.includes('link')) {
      return 'bg-gray-50';
    }
    // Tickets
    else if (attachment.filename.includes('ticket') || 
             attachment.filename.includes('issue')) {
      return 'bg-purple-50';
    }
    // Default
    else {
      return 'bg-blue-50';
    }
  };
  
  // Get border color to match the icon
  const getIconBorder = () => {
    // Images
    if (attachment.fileType.startsWith('image/')) {
      return 'border-blue-200';
    }
    // Documents
    else if (attachment.fileType.includes('document') || 
             attachment.fileType.includes('pdf') || 
             attachment.filename.endsWith('.pdf') ||
             attachment.filename.endsWith('.doc') ||
             attachment.filename.endsWith('.docx')) {
      return 'border-indigo-200';
    }
    // Spreadsheets
    else if (attachment.fileType.includes('csv') || 
             attachment.filename.endsWith('.csv') ||
             attachment.filename.endsWith('.xlsx') ||
             attachment.filename.endsWith('.xls')) {
      return 'border-green-200';
    }
    // Folders
    else if (attachment.fileType.includes('folder') || 
             attachment.filename.includes('folder')) {
      return 'border-orange-200';
    }
    // Links
    else if (attachment.fileType.includes('url') || 
             attachment.filename.startsWith('http') ||
             attachment.filename.includes('link')) {
      return 'border-gray-200';
    }
    // Tickets
    else if (attachment.filename.includes('ticket') || 
             attachment.filename.includes('issue')) {
      return 'border-purple-200';
    }
    // Default
    else {
      return 'border-blue-200';
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
      ) : (
        // Ultra simple file item with icon and name - like in the reference image
        <div 
          className="group flex items-center rounded-md bg-transparent hover:bg-gray-50 px-2 py-1.5 transition-colors cursor-pointer"
          onClick={() => setShowPreview(true)}
        >
          {/* File icon */}
          <div className={`h-6 w-6 ${getIconBackground()} flex items-center justify-center rounded-sm mr-2`}>
            {renderIcon()}
          </div>
          
          {/* Filename - simple text label */}
          <span className="text-sm text-gray-700 truncate mr-2">
            {attachment.filename}
          </span>
          
          {/* Actions - minimal */}
          <div className="flex gap-0.5 ml-auto">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-700 rounded-full"
              onClick={(e) => {
                e.stopPropagation(); // Prevent opening the preview
                handleDownload();
              }}
              title="Download"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 rounded-full"
              onClick={(e) => {
                e.stopPropagation(); // Prevent opening the preview
                handleDelete();
              }}
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
