import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AttachmentItem } from "./attachment-item";
import { Attachment } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

interface GPTOutputProps {
  output: string | null;
  attachments: Attachment[];
}

export function GPTOutput({ output, attachments }: GPTOutputProps) {
  if (!output && attachments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic p-3 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50">
        No AI output available yet. Try sending a message or retriggering the AI.
      </div>
    );
  }

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
          <div className="p-4 text-sm text-gray-800 whitespace-pre-line">
            {output}
          </div>
        </div>
      )}
    </div>
  );
}
