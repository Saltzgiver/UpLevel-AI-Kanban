import { useState, useEffect } from "react";
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
  const [imageLoadError, setImageLoadError] = useState(false);
  const { toast } = useToast();
  
  // Check if this is an image attachment
  const isImage = attachment.fileType.startsWith('image/');

  // Check if this is a CSV file
  const isCSV = attachment.fileType.includes('csv') || attachment.filename.endsWith('.csv');
  
  // Log attachment details on component mount for debugging
  useEffect(() => {
    console.log(`📎 [AttachmentItem] Rendering attachment:`, {
      id: attachment.id,
      filename: attachment.filename,
      fileType: attachment.fileType,
      isImage: isImage,
      isCSV: isCSV,
      contentLength: attachment.content ? attachment.content.length : 0
    });
  }, [attachment, isImage, isCSV]);

  const handleDownload = () => {
    try {
      // Use direct API endpoint for all files to ensure consistent behavior
      console.log(`📥 [AttachmentItem] Downloading attachment:`, {
        id: attachment.id,
        filename: attachment.filename,
        fileType: attachment.fileType
      });
      
      // Create a direct link to the attachment endpoint
      const link = document.createElement('a');
      link.href = `/api/attachments/${attachment.id}`;
      link.download = attachment.filename; // Force download by setting the download attribute
      
      // For better download handling, use _blank for images and CSVs
      if (isImage || isCSV) {
        link.target = "_blank";
      }
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("❌ [AttachmentItem] Error downloading attachment:", error);
      toast({
        title: "Download error",
        description: "There was a problem downloading this file. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async () => {
    console.log(`🗑️ [AttachmentItem] Deleting attachment:`, {
      id: attachment.id,
      filename: attachment.filename,
      fileType: attachment.fileType
    });
    
    setIsDeleting(true);
    
    try {
      await apiRequest("DELETE", `/api/attachments/${attachment.id}`, {});
      
      // Invalidate all relevant queries to ensure UI is updated properly
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cards/${attachment.cardId}/attachments`] });
      
      console.log(`✅ [AttachmentItem] Successfully deleted attachment:`, {
        id: attachment.id,
        filename: attachment.filename
      });
      
      // Call the onDelete callback if provided
      if (onDelete) {
        onDelete();
      }
      
      toast({
        title: "Success",
        description: "Attachment deleted successfully",
      });
    } catch (error) {
      console.error(`❌ [AttachmentItem] Error deleting attachment:`, {
        id: attachment.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      toast({
        title: "Error",
        description: "Failed to delete attachment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Determine icon based on file type - styled to match exactly the reference icons
  const renderIcon = () => {
    // Spreadsheets (CSV, Excel) - Green table icon
    if (attachment.fileType.includes('csv') || 
        attachment.filename.endsWith('.csv') ||
        attachment.filename.endsWith('.xlsx') ||
        attachment.filename.endsWith('.xls')) {
      return <Table className="h-5 w-5 text-green-500" />;
    }
    // Folders - Google Drive style icon with colors
    else if (attachment.fileType.includes('folder') || 
             attachment.filename.includes('folder')) {
      return <Folder className="h-5 w-5 text-blue-500" />;
    }
    // Tickets or Issues - Blue ticket icon
    else if (attachment.filename.includes('ticket') || 
             attachment.filename.includes('issue')) {
      return <Ticket className="h-5 w-5 text-blue-500" />;
    }
    // Links - Gray link icon
    else if (attachment.fileType.includes('url') || 
             attachment.filename.startsWith('http') ||
             attachment.filename.includes('link')) {
      return <LinkIcon className="h-5 w-5 text-gray-500" />;
    }
    // Images
    else if (attachment.fileType.startsWith('image/')) {
      return <Image className="h-5 w-5 text-purple-500" />;
    } 
    // Documents (PDF, Word, etc.)
    else if (attachment.fileType.includes('document') || 
             attachment.fileType.includes('pdf') || 
             attachment.filename.endsWith('.pdf') ||
             attachment.filename.endsWith('.doc') ||
             attachment.filename.endsWith('.docx')) {
      return <FileText className="h-5 w-5 text-indigo-500" />;
    } 
    // Default - colorful file icon
    else {
      return <File className="h-5 w-5 text-blue-500" />;
    }
  };
  
  // Create a URL for attachment content - either using API endpoint for images or data URL for other types
  const getAttachmentUrl = () => {
    console.log(`🔗 [AttachmentItem] Getting URL for attachment:`, {
      id: attachment.id,
      isImage: isImage
    });
    
    // Use the direct API endpoint for images to improve performance
    if (isImage) {
      const imageUrl = `/api/attachments/${attachment.id}`;
      console.log(`🖼️ [AttachmentItem] Using API endpoint for image:`, imageUrl);
      return imageUrl;
    }
    
    // Fall back to data URL for other content types when needed
    console.log(`📄 [AttachmentItem] Using data URL for non-image attachment:`, {
      type: attachment.fileType,
      contentLength: attachment.content ? attachment.content.length : 0
    });
    return `data:${attachment.fileType};base64,${attachment.content}`;
  };
  
  // Safely decode base64 content for CSV files
  const getCSVContent = () => {
    try {
      console.log(`📊 [AttachmentItem] Processing CSV content for attachment:`, {
        id: attachment.id,
        filename: attachment.filename,
        contentLength: attachment.content ? attachment.content.length : 0
      });
      
      if (!attachment.content) {
        console.warn(`⚠️ [AttachmentItem] Empty content for CSV file:`, attachment.id);
        return "";
      }
      
      // Check if content is already in text format
      if (attachment.content.trim().startsWith('id,') || 
          attachment.content.trim().startsWith('name,') ||
          attachment.content.includes('\n') || 
          attachment.content.includes(',')) {
        console.log(`📄 [AttachmentItem] Content appears to be plain text CSV already`);
        return attachment.content;
      }
      
      // Try to decode base64 using a safer method
      try {
        console.log(`🔄 [AttachmentItem] Attempting to decode base64 content for CSV`);
        // Use a safer approach to decode base64
        const binaryStr = window.atob(attachment.content);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const decoded = new TextDecoder().decode(bytes);
        console.log(`✅ [AttachmentItem] Successfully decoded CSV content`, {
          decodedLength: decoded.length,
          previewStart: decoded.substring(0, 50) + '...'
        });
        return decoded;
      } catch (decodeError) {
        console.error(`❌ [AttachmentItem] Base64 decoding failed:`, decodeError);
        return attachment.content;
      }
    } catch (error) {
      console.error(`❌ [AttachmentItem] Error processing CSV content:`, error);
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
            onClick={() => {
              console.log(`🖱️ [AttachmentItem] Image preview clicked for:`, {
                id: attachment.id,
                filename: attachment.filename
              });
              setShowPreview(true);
            }}
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
            
            {imageLoadError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <div className="text-center p-2">
                  <Image className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-500">Error loading image</p>
                </div>
              </div>
            ) : (
              <img 
                src={getAttachmentUrl()} 
                alt={attachment.filename} 
                className="absolute inset-0 w-full h-full object-cover"
                onLoad={() => {
                  console.log(`✅ [AttachmentItem] Image loaded successfully:`, {
                    id: attachment.id,
                    filename: attachment.filename
                  });
                  setImageLoadError(false);
                }}
                onError={(e) => {
                  console.error(`❌ [AttachmentItem] Error loading image:`, {
                    id: attachment.id,
                    filename: attachment.filename,
                    error: e
                  });
                  setImageLoadError(true);
                }}
              />
            )}
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
        // Ultra minimal horizontal layout with icons directly next to filename
        <div 
          className="flex items-center gap-2 py-1 w-full cursor-pointer hover:bg-gray-50 rounded px-1"
          onClick={() => {
            console.log(`🖱️ [AttachmentItem] Non-image file clicked for preview:`, {
              id: attachment.id,
              filename: attachment.filename,
              fileType: attachment.fileType
            });
            setShowPreview(true);
          }}
        >
          {/* File icon - more minimal and simplified */}
          <div className="flex-shrink-0">
            {renderIcon()}
          </div>
          
          {/* Filename with icons placed directly after it */}
          <div className="flex items-center flex-1">
            <span className="text-sm text-gray-700 mr-2 truncate max-w-[200px]" title={attachment.filename}>
              {attachment.filename}
            </span>
            
            {/* File type badge for CSV */}
            {isCSV && (
              <span className="text-xs bg-green-100 text-green-800 rounded-full px-2 py-0.5 mr-1">
                CSV
              </span>
            )}
            
            {/* Actions - immediately after filename */}
            <div className="flex ml-auto">
              <button
                className="text-gray-400 hover:text-gray-700 mx-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded p-1"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent opening the preview
                  handleDownload();
                }}
                title="Download"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                className="text-gray-400 hover:text-red-600 mx-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 rounded p-1"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent opening the preview
                  handleDelete();
                }}
                disabled={isDeleting}
                title="Delete"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Preview Modal for Images and CSV Files using Dialog component */}
      <Dialog 
        open={showPreview} 
        onOpenChange={(open) => {
          console.log(`🖼️ [AttachmentItem] Preview dialog ${open ? 'opened' : 'closed'} for:`, {
            id: attachment.id,
            filename: attachment.filename,
            type: isImage ? 'image' : isCSV ? 'CSV' : 'other'
          });
          setShowPreview(open);
        }}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center">
                {renderIcon()}
                <span className="ml-2">{attachment.filename}</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center bg-black/5 min-h-[300px] p-6">
            {isImage && (
              imageLoadError ? (
                <div className="text-center p-4">
                  <Image className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Error loading image.</p>
                  <p className="text-gray-500 text-sm mt-2">Try downloading the file instead.</p>
                </div>
              ) : (
                <img 
                  src={getAttachmentUrl()} 
                  alt={attachment.filename} 
                  className="max-w-full max-h-[70vh] object-contain" 
                  onLoad={() => {
                    console.log(`✅ [AttachmentItem] Preview image loaded successfully:`, {
                      id: attachment.id,
                      filename: attachment.filename
                    });
                    setImageLoadError(false);
                  }}
                  onError={(e) => {
                    console.error(`❌ [AttachmentItem] Error loading preview image:`, {
                      id: attachment.id,
                      filename: attachment.filename,
                      error: e
                    });
                    setImageLoadError(true);
                  }}
                />
              )
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
            <div className="flex gap-2">
              {isImage && (
                <a 
                  href={getAttachmentUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs flex items-center text-blue-600 hover:text-blue-800"
                  onClick={() => {
                    console.log(`🔗 [AttachmentItem] Opening image in new tab:`, {
                      id: attachment.id,
                      filename: attachment.filename
                    });
                  }}
                >
                  <Maximize2 className="h-3 w-3 mr-1" />
                  View full size
                </a>
              )}
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
        </DialogContent>
      </Dialog>
    </>
  );
}
