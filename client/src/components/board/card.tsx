import { Draggable } from "@hello-pangea/dnd";
import { Card as CardType } from "@shared/schema";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProcessingIndicator } from "@/components/ui/processing-indicator";
import { useCardProcessing } from "@/hooks/use-card-processing";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface CardProps {
  card: CardType & { commentCount?: number };
  index: number;
  onClick: () => void;
}

interface ProcessingStatus {
  processing: boolean;
  gptOutput: string | null;
}

export function Card({ card, index, onClick }: CardProps) {
  // Use our unified processing hook instead of custom implementation
  const {
    isProcessing,
    gptOutput
  } = useCardProcessing(card.id);
  
  // We'll use the gptOutput from the real-time status if available,
  // otherwise fall back to the card's stored output
  const finalOutput = gptOutput || card.gptOutput;
  
  const [expanded, setExpanded] = useState(false);
  
  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <Draggable draggableId={card.id.toString()} index={index}>
      {(provided, snapshot) => (
        <div
          className={`card bg-white rounded-md border border-gray-200 mb-3 cursor-pointer hover:shadow-md transition-all ${
            snapshot.isDragging ? "shadow-lg rotate-1" : ""
          }`}
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          style={{ 
            ...provided.draggableProps.style,
            // Ensure this element doesn't interact with column dragging
            zIndex: snapshot.isDragging ? 1000 : 1,
          }}
        >
          {/* Card left accent bar for visual distinction */}
          <div className="flex">
            <div className="w-1 bg-blue-500 rounded-l-md"></div>
            <div className="p-3 w-full">
              <div className="text-sm font-semibold text-gray-800 mb-2">{card.title}</div>
              
              {/* Tag-like elements could go here */}
              <div className="flex flex-wrap gap-1 mb-2">
                {/* Empty container for future tags if needed */}
              </div>
              
              {/* Use our unified ProcessingIndicator - simplified props */}
              <ProcessingIndicator
                isProcessing={isProcessing}
                compact={true}
              />
              
              {/* Show GPT output if it exists and not processing */}
              {finalOutput && !isProcessing && (
                <div className="mt-2 pt-2 text-xs text-gray-600 border-t border-gray-100">
                  <div className="font-medium mb-1 text-gray-500">AI Output</div>
                  <div 
                    className={expanded ? "prose prose-sm max-w-full" : "line-clamp-2 prose prose-sm max-w-full"}
                    onClick={handleExpand}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: (props: any) => <p className="my-0.5 text-xs" {...props} />,
                        ul: (props: any) => <ul className="list-disc pl-3 my-0.5 text-xs" {...props} />,
                        ol: (props: any) => <ol className="list-decimal pl-3 my-0.5 text-xs" {...props} />,
                        li: (props: any) => <li className="my-0 text-xs" {...props} />,
                        a: (props: any) => <a className="text-blue-600 hover:underline text-xs" {...props} />,
                        code: (props: any) => 
                          props.inline 
                            ? <code className="bg-gray-100 px-0.5 rounded text-[10px] font-mono" {...props} />
                            : <code className="block bg-gray-100 p-1 rounded text-[10px] font-mono my-0.5 overflow-x-auto" {...props} />,
                        pre: (props: any) => <pre className="bg-gray-100 p-1 rounded text-[10px] font-mono my-0.5 overflow-x-auto" {...props} />,
                        strong: (props: any) => <strong className="font-bold text-xs" {...props} />,
                        em: (props: any) => <em className="italic text-xs" {...props} />,
                      }}
                    >
                      {finalOutput}
                    </ReactMarkdown>
                  </div>
                  {finalOutput.length > 100 && (
                    <button 
                      className="text-xs text-blue-600 mt-1 hover:underline font-medium"
                      onClick={handleExpand}
                    >
                      {expanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
