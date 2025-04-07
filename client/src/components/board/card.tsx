import { Draggable } from "@hello-pangea/dnd";
import { Card as CardType } from "@shared/schema";
import { useState, useEffect } from "react";
import { ProcessingIndicator } from "@/components/ui/processing-indicator";
import { useCardProcessing } from "@/hooks/use-card-processing";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface CardProps {
  card: CardType & { commentCount?: number };
  index: number;
  onClick: () => void;
}

// Helper function to auto-scroll to a dragged card when it's near the edge
const autoScrollDuringDrag = (dragging: boolean, transform: string | undefined) => {
  if (!dragging || !transform) return;
  
  const container = document.getElementById('board-container');
  if (!container) return;
  
  // Extract X position from transform string "translate(Xpx, Ypx)"
  const match = transform.match(/translate\(([^,]+)px/);
  if (!match || !match[1]) return;
  
  const xPos = parseFloat(match[1]);
  const containerRect = container.getBoundingClientRect();
  const containerWidth = containerRect.width;
  const scrollLeft = container.scrollLeft;
  
  // If card is dragged near right edge, scroll right
  if (xPos > containerWidth - 150 + scrollLeft) {
    container.scrollTo({
      left: scrollLeft + 50,
      behavior: 'smooth'
    });
  }
  // If card is dragged near left edge, scroll left
  else if (xPos < 150 + scrollLeft) {
    container.scrollTo({
      left: Math.max(0, scrollLeft - 50),
      behavior: 'smooth'
    });
  }
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
  const [dragTransform, setDragTransform] = useState<string | undefined>(undefined);
  
  // Use this effect to trigger auto-scrolling when a card is dragged
  useEffect(() => {
    if (dragTransform) {
      const interval = setInterval(() => {
        autoScrollDuringDrag(true, dragTransform);
      }, 200);
      
      return () => clearInterval(interval);
    }
  }, [dragTransform]);
  
  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <Draggable draggableId={card.id.toString()} index={index}>
      {(provided, snapshot) => {
        // Update dragTransform state when card is dragged
        if (snapshot.isDragging && provided.draggableProps.style?.transform) {
          console.log("Card being dragged:", card.id, "Position:", provided.draggableProps.style.transform);
          // Only update if transform changed to avoid unnecessary re-renders
          if (dragTransform !== provided.draggableProps.style.transform) {
            setDragTransform(provided.draggableProps.style.transform as string);
          }
        } else if (!snapshot.isDragging && dragTransform) {
          // Reset dragTransform when no longer dragging
          setDragTransform(undefined);
        }
        
        return (
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
              // Add a constraint to prevent dragging off-screen
              maxWidth: "280px"
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
        );
      }}
    </Draggable>
  );
}
