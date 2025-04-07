import { Draggable } from "@hello-pangea/dnd";
import { Card as CardType } from "@shared/schema";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProcessingIndicator } from "@/components/ui/processing-indicator";
import { useCardProcessing } from "@/hooks/use-card-processing";

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
    isProcessingTimedOut,
    processingError,
    resetProcessingState
  } = useCardProcessing(card.id);
  
  // For the card preview, we'll only check active processing
  // More detailed states will be visible in the modal
  
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
                {/* Sample tags for visual design only */}
                {card.processing && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                    Processing
                  </span>
                )}
              </div>
              
              {/* Use our unified ProcessingIndicator */}
              <ProcessingIndicator
                isProcessing={isProcessing}
                isTimedOut={isProcessingTimedOut}
                error={processingError}
                onReset={resetProcessingState}
                compact={true}
              />
              
              {/* Show GPT output if it exists */}
              {card.gptOutput && !isProcessing && (
                <div className="mt-2 pt-2 text-xs text-gray-600 border-t border-gray-100">
                  <div className="font-medium mb-1 text-gray-500">Last GPT Output</div>
                  <div 
                    className={expanded ? "" : "line-clamp-2"}
                    onClick={handleExpand}
                  >
                    {card.gptOutput}
                  </div>
                  {card.gptOutput.length > 100 && (
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
