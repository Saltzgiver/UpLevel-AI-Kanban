import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AttachmentItem } from "./attachment-item";
import { Attachment } from "@shared/schema";

interface GPTOutputProps {
  output: string | null;
  attachments: Attachment[];
}

export function GPTOutput({ output, attachments }: GPTOutputProps) {
  const [showOutput, setShowOutput] = useState(true);
  
  if (!output && attachments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No GPT output available yet.
      </div>
    );
  }

  return (
    <div className="mb-3">
      <Button
        variant="ghost"
        className="flex items-center p-0 h-auto mb-1 text-xs font-medium text-muted-foreground"
        onClick={() => setShowOutput(!showOutput)}
      >
        <span>GPT Output</span>
        {showOutput ? (
          <ChevronUp className="h-4 w-4 ml-1" />
        ) : (
          <ChevronDown className="h-4 w-4 ml-1" />
        )}
      </Button>
      
      {showOutput && (
        <>
          {output && (
            <div className="text-sm text-foreground bg-gray-50 p-2 rounded border border-gray-100 mb-3 whitespace-pre-line">
              {output}
            </div>
          )}
          
          {/* Attachments */}
          {attachments.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Attachments:</div>
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <AttachmentItem 
                    key={attachment.id} 
                    attachment={attachment} 
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
