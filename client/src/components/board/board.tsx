import { useState, createContext, useContext, ReactNode } from "react";
import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";
import { Column } from "./column";
import { AddColumn } from "./add-column";
import { CardModal } from "../ui/card-modal";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Board, Column as ColumnType, Card as CardType, Chat, Attachment } from "@shared/schema";

type DndContextType = {
  onDragEnd: (result: DropResult) => void;
};

const DndContext = createContext<DndContextType | undefined>(undefined);

export function DndProvider({ children }: { children: ReactNode }) {
  const dndValue: DndContextType = {
    onDragEnd: () => {}, // Will be overridden by the Board component
  };

  return (
    <DndContext.Provider value={dndValue}>
      {children}
    </DndContext.Provider>
  );
}

interface BoardProps {
  board: Board;
  columns: (ColumnType & {
    cards: (CardType & {
      chats?: Chat[];
      attachments?: Attachment[];
    })[];
  })[];
  isLoading: boolean;
}

export function BoardComponent({ board, columns, isLoading }: BoardProps) {
  const [selectedCard, setSelectedCard] = useState<CardType & { 
    chats?: Chat[];
    attachments?: Attachment[];
  } | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<ColumnType | null>(null);
  const [deleteCardId, setDeleteCardId] = useState<number | null>(null);
  const [deleteColumnId, setDeleteColumnId] = useState<number | null>(null);
  const { toast } = useToast();
  const dndContext = useContext(DndContext);

  if (!dndContext) {
    throw new Error("Board must be used within DndProvider");
  }

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId, type } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Handle column reordering
    if (type === "column") {
      const newColumnOrder = Array.from(columns);
      const movedColumn = newColumnOrder.find(
        (col) => col.id.toString() === draggableId
      );

      if (!movedColumn) return;

      newColumnOrder.splice(source.index, 1);
      newColumnOrder.splice(destination.index, 0, movedColumn);

      // Update column orders
      const updates = newColumnOrder.map((col, index) => ({
        id: col.id,
        order: index,
      }));

      try {
        await apiRequest("PATCH", `/api/boards/${board.id}/reorder-columns`, { updates });
        queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to reorder columns",
          variant: "destructive",
        });
      }
      return;
    }

    // Handle card reordering
    const sourceColId = parseInt(source.droppableId);
    const destColId = parseInt(destination.droppableId);
    const cardId = parseInt(draggableId);

    const sourceColumn = columns.find((col) => col.id === sourceColId);
    const destColumn = columns.find((col) => col.id === destColId);

    if (!sourceColumn || !destColumn) return;

    if (sourceColId === destColId) {
      // Reordering within the same column
      const newCards = Array.from(sourceColumn.cards);
      const movedCard = newCards.find((card) => card.id === cardId);

      if (!movedCard) return;

      newCards.splice(source.index, 1);
      newCards.splice(destination.index, 0, movedCard);

      // Update card orders
      const updates = newCards.map((card, index) => ({
        id: card.id,
        order: index,
      }));

      try {
        await apiRequest("PATCH", `/api/columns/${sourceColId}/reorder-cards`, { updates });
        queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to reorder cards",
          variant: "destructive",
        });
      }
    } else {
      // Moving card to another column
      try {
        await apiRequest("PATCH", `/api/cards/${cardId}/move`, {
          destinationColumnId: destColId,
          position: destination.index,
        });
        queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
        
        // If the destination column has a GPT assigned and auto-trigger is enabled
        if (destColumn.gptAssigned && destColumn.autoTrigger) {
          toast({
            title: "GPT Processing",
            description: `Card will be processed by ${destColumn.gptName}`,
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to move card",
          variant: "destructive",
        });
      }
    }
  };

  // Override the onDragEnd function in the context
  dndContext.onDragEnd = onDragEnd;

  const handleCardClick = (card: CardType & { 
    chats?: Chat[];
    attachments?: Attachment[];
  }, column: ColumnType) => {
    setSelectedCard(card);
    setSelectedColumn(column);
  };

  const handleCloseCardModal = () => {
    setSelectedCard(null);
    setSelectedColumn(null);
  };

  const handleDeleteCard = (cardId: number) => {
    setDeleteCardId(cardId);
  };

  const handleDeleteColumn = (columnId: number) => {
    setDeleteColumnId(columnId);
  };

  const confirmDeleteCard = async () => {
    if (!deleteCardId) return;

    try {
      await apiRequest("DELETE", `/api/cards/${deleteCardId}`, {});
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      toast({
        title: "Success",
        description: "Card deleted",
      });
      setDeleteCardId(null);
      handleCloseCardModal();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete card",
        variant: "destructive",
      });
    }
  };

  const confirmDeleteColumn = async () => {
    if (!deleteColumnId) return;

    try {
      await apiRequest("DELETE", `/api/columns/${deleteColumnId}`, {});
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      toast({
        title: "Success",
        description: "Column deleted",
      });
      setDeleteColumnId(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete column",
        variant: "destructive",
      });
    }
  };

  const handleMoveCard = async (cardId: number, sourceColumnId: number, destinationColumnId: number) => {
    try {
      await apiRequest("PATCH", `/api/cards/${cardId}/move`, {
        destinationColumnId,
        position: 0, // Place at the top of the destination column
      });
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      handleCloseCardModal();
      
      // If the destination column has a GPT assigned and auto-trigger is enabled
      const destColumn = columns.find(col => col.id === destinationColumnId);
      if (destColumn?.gptAssigned && destColumn?.autoTrigger) {
        toast({
          title: "GPT Processing",
          description: `Card will be processed by ${destColumn.gptName}`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to move card",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="board-container pb-4 flex space-x-4 overflow-x-auto">
      <DragDropContext onDragEnd={dndContext.onDragEnd}>
        <Droppable droppableId="board" type="column" direction="horizontal">
          {(provided) => (
            <div 
              className="flex space-x-4"
              ref={provided.innerRef} 
              {...provided.droppableProps}
            >
              {columns.map((column, index) => (
                <Column
                  key={column.id}
                  column={column}
                  index={index}
                  onCardClick={handleCardClick}
                  onDeleteColumn={handleDeleteColumn}
                />
              ))}
              {provided.placeholder}
              <AddColumn boardId={board.id} />
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {selectedCard && selectedColumn && (
        <CardModal
          card={selectedCard}
          column={selectedColumn}
          columns={columns}
          isOpen={!!selectedCard}
          onClose={handleCloseCardModal}
          onDelete={handleDeleteCard}
          onMove={handleMoveCard}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteCardId}
        onClose={() => setDeleteCardId(null)}
        onConfirm={confirmDeleteCard}
        title="Delete Card"
        description="Are you sure you want to delete this card? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />

      <ConfirmDialog
        isOpen={!!deleteColumnId}
        onClose={() => setDeleteColumnId(null)}
        onConfirm={confirmDeleteColumn}
        title="Delete Column"
        description="Are you sure you want to delete this column and all its cards? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}
