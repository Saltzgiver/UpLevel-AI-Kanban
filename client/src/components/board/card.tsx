import { Draggable } from "@hello-pangea/dnd";
import { MessageSquare } from "lucide-react";
import { Card as CardType } from "@shared/schema";
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface CardProps {
  card: CardType & { commentCount?: number };
  index: number;
  onClick: () => void;
}

export function Card({ card, index, onClick }: CardProps) {
  const [isProcessing, setIsProcessing] = useState(card.processing || false);
  const queryClient = useQueryClient();
  const pollingRef = useRef<number | null>(null);
  
  // A simpler approach without full useCardProcessing to avoid re-render loops
  useEffect(() => {
    // Update initial processing state from card prop
    setIsProcessing(card.processing || false);
    
    // If card is processing, set up polling
    if (card.processing) {
      // Start polling for status updates
      const pollStatus = () => {
        fetch(`/api/cards/${card.id}/processing-status`)
          .then(res => res.json())
          .then(data => {
            setIsProcessing(data.processing);
            
            // If processing is complete, stop polling and invalidate queries
            if (!data.processing && card.processing) {
              if (pollingRef.current) {
                window.clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
              // Refresh board data
              queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
            }
          })
          .catch(err => console.error("Error polling card status:", err));
      };
      
      // Poll every second
      pollingRef.current = window.setInterval(pollStatus, 1000);
      
      // Clean up on unmount
      return () => {
        if (pollingRef.current) {
          window.clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };
    }
  }, [card.id, card.processing, queryClient]);
  
  const showProcessing = isProcessing;
  
  return (
    <Draggable draggableId={card.id.toString()} index={index}>
      {(provided, snapshot) => (
        <div
          className={`card bg-card rounded shadow-sm mb-2 cursor-pointer hover:bg-accent/10 transition-colors ${
            snapshot.isDragging ? "shadow-md rotate-2" : ""
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
          <div className="p-2">
            <div className="text-sm text-foreground mb-2">{card.title}</div>
            
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
            
            {/* Show snippet of GPT output if it exists */}
            {card.gptOutput && !showProcessing && (
              <div className="border-t border-border mt-2 pt-2 text-xs text-muted-foreground">
                <div className="line-clamp-2">{card.gptOutput}</div>
              </div>
            )}
            
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <MessageSquare className="h-3 w-3 mr-1" />
              <span>{card.commentCount || 0}</span>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
