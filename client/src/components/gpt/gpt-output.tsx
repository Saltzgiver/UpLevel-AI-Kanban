import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, Sparkles, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AttachmentItem } from "./attachment-item";
import { Attachment } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileUpload } from "@/components/ui/file-upload";

interface GPTOutputProps {
  output: string | null;
  attachments: Attachment[];
  cardId?: number;
}

export function GPTOutput({ output, attachments, cardId }: GPTOutputProps) {
  const [showAllAttachments, setShowAllAttachments] = useState(attachments.length <= 2);
  
  if (!output && attachments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic p-3 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50">
        No AI output available yet. Try sending a message or retriggering the AI.
      </div>
    );
  }

  const visibleAttachments = showAllAttachments ? attachments : attachments.slice(0, 2);
  const hasMoreAttachments = attachments.length > 2;

  return (
    <div>
      {output && (
        <div className="rounded-lg bg-white border border-green-100 overflow-hidden shadow-sm mb-4">
          <div className="px-3 py-2 bg-green-50 border-b border-green-100 flex items-center">
            <Sparkles className="h-4 w-4 text-green-600 mr-2" />
            <span className="text-sm font-medium text-green-800">AI Generated Response</span>
            <Badge variant="outline" className="ml-auto text-xs font-normal py-0 h-5 bg-green-50 border-green-200 text-green-700">
              Primary Output
            </Badge>
          </div>
          <div className="p-4 text-sm text-gray-800 prose prose-sm max-w-full">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: (props: any) => <h1 className="text-base font-bold mt-3 mb-2" {...props} />,
                h2: (props: any) => <h2 className="text-sm font-bold mt-2 mb-1" {...props} />,
                h3: (props: any) => <h3 className="text-xs font-bold mt-2 mb-1" {...props} />,
                p: (props: any) => <p className="mb-1.5 text-xs" {...props} />,
                ul: (props: any) => <ul className="list-disc pl-4 mb-1.5 text-xs" {...props} />,
                ol: (props: any) => <ol className="list-decimal pl-4 mb-1.5 text-xs" {...props} />,
                li: (props: any) => <li className="mb-0.5 text-xs" {...props} />,
                a: (props: any) => <a className="text-blue-600 hover:underline text-xs" {...props} />,
                blockquote: (props: any) => <blockquote className="border-l-4 border-gray-200 pl-3 italic my-1.5 text-xs" {...props} />,
                code: (props: any) => 
                  props.inline 
                    ? <code className="bg-gray-100 px-0.5 rounded text-[10px] font-mono" {...props} />
                    : <code className="block bg-gray-100 p-1.5 rounded-md text-[10px] font-mono my-1.5 overflow-x-auto" {...props} />,
                pre: (props: any) => <pre className="bg-gray-100 p-2 rounded-md text-[10px] font-mono my-1.5 overflow-x-auto" {...props} />,
                strong: (props: any) => <strong className="font-bold text-xs" {...props} />,
                em: (props: any) => <em className="italic text-xs" {...props} />,
                hr: (props: any) => <hr className="my-3 border-gray-200" {...props} />,
              }}
            >
              {output}
            </ReactMarkdown>
          </div>
        </div>
      )}
      
      {attachments.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center mb-2">
            <div className="flex items-center flex-1">
              <Paperclip className="h-4 w-4 text-gray-500 mr-2" />
              <span className="text-sm font-medium text-gray-800 mr-2">Attachments ({attachments.length})</span>
              {cardId && (
                <div onClick={(e) => e.stopPropagation()}>
                  <FileUpload cardId={cardId} iconOnly={true} />
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="flex flex-col">
              {visibleAttachments.map(attachment => (
                <div key={attachment.id}>
                  <AttachmentItem 
                    attachment={attachment} 
                    onDelete={() => {
                      // This will refresh the query after deletion
                      // We rely on the AttachmentItem component to handle the actual deletion
                    }}
                  />
                </div>
              ))}
            </div>
            
            {hasMoreAttachments && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 mt-3 flex items-center justify-center"
                onClick={() => setShowAllAttachments(!showAllAttachments)}
              >
                {showAllAttachments ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5 mr-1" />
                    Show fewer files
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5 mr-1" />
                    Show {attachments.length - 2} more files
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
