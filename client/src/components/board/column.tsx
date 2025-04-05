import { useState } from "react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { Card } from "./card";
import { AddCard } from "./add-card";
import { ColumnHeader } from "./column-header";
import { GPTBanner } from "../gpt/gpt-banner";
import { Column as ColumnType, Card as CardType, Chat, Attachment } from "@shared/schema";

interface ColumnProps {
  column: ColumnType & {
    cards: (CardType & {
      chats?: Chat[];
      attachments?: Attachment[];
    })[];
  };
  index: number;
  onCardClick: (card: CardType & { 
    chats?: Chat[];
    attachments?: Attachment[];
  }, column: ColumnType) => void;
  onDeleteColumn: (columnId: number) => void;
}

export function Column({ column, index, onCardClick, onDeleteColumn }: ColumnProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  
  return (
    <Draggable draggableId={column.id.toString()} index={index}>
      {(provided) => (
        <div
          className="column bg-muted rounded-md shadow-sm w-72 flex-shrink-0"
          ref={provided.innerRef}
          {...provided.draggableProps}
        >
          <div className="p-2 flex flex-col h-full">
            <ColumnHeader 
              column={column}
              provided={provided}
              isEditingTitle={isEditingTitle}
              setIsEditingTitle={setIsEditingTitle}
              onDeleteColumn={onDeleteColumn}
            />
            
            <GPTBanner column={column} />
            
            <Droppable droppableId={column.id.toString()} type="card">
              {(provided, snapshot) => (
                <div
                  className={`column-content flex-1 overflow-y-auto min-h-[100px] ${
                    snapshot.isDraggingOver ? "bg-primary/5" : ""
                  }`}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {column.cards.map((card, index) => (
                    <Card 
                      key={card.id} 
                      card={card} 
                      index={index} 
                      onClick={() => onCardClick(card, column)}
                    />
                  ))}
                  {provided.placeholder}
                  <AddCard columnId={column.id} />
                </div>
              )}
            </Droppable>
          </div>
        </div>
      )}
    </Draggable>
  );
}
