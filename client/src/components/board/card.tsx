import { Draggable } from "@hello-pangea/dnd";
import { Card as CardType } from "@shared/schema";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  const [isProcessing, setIsProcessing] = useState(card.processing || false);
  const queryClient = useQueryClient();
  
  // Only use React Query when the card is already in processing state
  // This is more efficient than polling all cards
  const enabled = Boolean(card.processing);
  
  // Simple query for processing status
  const { data } = useQuery<ProcessingStatus>({
    queryKey: [`/api/cards/${card.id}/processing-status`],
    enabled: enabled,
    refetchInterval: enabled ? 2000 : false, // Poll every 2 seconds if enabled
    staleTime: 1000,
  });
  
  // Update processing state when data changes
  useEffect(() => {
    if (data) {
      setIsProcessing(data.processing);
      
      // If processing is complete, invalidate board queries
      if (!data.processing && card.processing) {
        queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      }
    } else {
      // Fall back to prop if no data available
      setIsProcessing(card.processing || false);
    }
  }, [data, card.processing, queryClient]);
  
  const showProcessing = isProcessing;
  
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
              
              {/* GPT Processing Indicator */}
              {showProcessing && (
                <div className="bg-yellow-50 border border-yellow-100 rounded p-2 mb-2 text-xs">
                  <div className="flex items-center text-yellow-700">
                    <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    GPT is processing...
                  </div>
                </div>
              )}
              
              {/* Show GPT output if it exists */}
              {card.gptOutput && !showProcessing && (
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
