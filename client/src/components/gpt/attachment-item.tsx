import { useState } from "react";
import { Download, Trash2, FileText, Image, File } from "lucide-react";
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
      return <Image className="h-4 w-4 text-blue-500 mr-1" />;
    } else if (attachment.fileType.includes('document') || attachment.fileType.includes('pdf')) {
      return <FileText className="h-4 w-4 text-blue-500 mr-1" />;
    } else {
      return <File className="h-4 w-4 text-blue-500 mr-1" />;
    }
  };

  return (
    <div className="flex items-center bg-blue-50 rounded p-1.5 border border-blue-100">
      {renderIcon()}
      <span className="text-xs text-blue-700">{attachment.filename}</span>
      <div className="ml-auto flex">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground mr-1"
          onClick={handleDownload}
          title="Download"
        >
          <Download className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
          onClick={handleDelete}
          disabled={isDeleting}
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
