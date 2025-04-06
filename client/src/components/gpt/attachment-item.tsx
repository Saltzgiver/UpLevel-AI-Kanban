import { useState } from "react";
import { Download, Trash2, FileText, Image, File, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Attachment } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AttachmentItemProps {
  attachment: Attachment;
}

export function AttachmentItem({ attachment }: AttachmentItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
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

  return (
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
  );
}
