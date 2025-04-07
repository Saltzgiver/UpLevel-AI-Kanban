import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AttachmentItem } from "./attachment-item";
import { Attachment } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
    </div>
  );
}
