import { Draggable } from "@hello-pangea/dnd";
import { MessageSquare } from "lucide-react";
import { Card as CardType } from "@shared/schema";
import { useCardProcessing } from "@/hooks/use-card-processing";

interface CardProps {
  card: CardType & { commentCount?: number };
  index: number;
  onClick: () => void;
}

export function Card({ card, index, onClick }: CardProps) {
  // Monitor processing status with real-time updates
  const { isProcessing } = useCardProcessing(card.id);
  
  // Use the real-time processing status if available, fall back to card.processing
  const showProcessing = isProcessing || card.processing;
  
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
