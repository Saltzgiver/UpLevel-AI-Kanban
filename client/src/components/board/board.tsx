import { useState, createContext, useContext, ReactNode } from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { Column } from "./column-wrapper";
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
        // Optimistically update local query data to avoid UI flickering
        queryClient.setQueryData([`/api/boards`], (oldData: any) => {
          if (!oldData) return oldData;
          
          // Create deep copy of the data to avoid mutating the cache directly
          const newData = JSON.parse(JSON.stringify(oldData));
          
          // Find the board and update the column's cards order
          const boardIndex = newData.findIndex((b: any) => b.id === board.id);
          if (boardIndex !== -1) {
            const columnIndex = newData[boardIndex].columns.findIndex(
              (col: any) => col.id === sourceColId
            );
            if (columnIndex !== -1) {
              newData[boardIndex].columns[columnIndex].cards = newCards;
            }
          }
          
          return newData;
        });
        
        await apiRequest("PATCH", `/api/columns/${sourceColId}/reorder-cards`, { updates });
        
        // Quietly refresh data in the background without causing UI jumps
        queryClient.invalidateQueries({ 
          queryKey: [`/api/boards`],
          refetchType: 'none' // Don't trigger an immediate refetch
        });
        
        // Schedule a quiet refetch after a short delay
        setTimeout(() => {
          queryClient.refetchQueries({ queryKey: [`/api/boards`] });
        }, 1000);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to reorder cards",
          variant: "destructive",
        });
        // Refresh the data to revert to the correct state if the operation failed
        queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      }
    } else {
      // Moving card to another column
      try {
        // Get the card that's being moved
        const movedCard = sourceColumn.cards.find(card => card.id === cardId);
        if (!movedCard) return;
        
        // Create a copy of the card for the destination column
        const cardCopy = { ...movedCard, columnId: destColId };
        
        // Optimistically update local query data to avoid UI flickering
        queryClient.setQueryData([`/api/boards`], (oldData: any) => {
          if (!oldData) return oldData;
          
          // Create deep copy of the data to avoid mutating the cache directly
          const newData = JSON.parse(JSON.stringify(oldData));
          
          // Find the board
          const boardIndex = newData.findIndex((b: any) => b.id === board.id);
          if (boardIndex !== -1) {
            // Remove the card from source column
            const sourceColumnIndex = newData[boardIndex].columns.findIndex(
              (col: any) => col.id === sourceColId
            );
            if (sourceColumnIndex !== -1) {
              newData[boardIndex].columns[sourceColumnIndex].cards = 
                newData[boardIndex].columns[sourceColumnIndex].cards.filter(
                  (c: any) => c.id !== cardId
                );
            }
            
            // Add the card to destination column
            const destColumnIndex = newData[boardIndex].columns.findIndex(
              (col: any) => col.id === destColId
            );
            if (destColumnIndex !== -1) {
              const destCards = [...newData[boardIndex].columns[destColumnIndex].cards];
              
              // Update card's column ID
              const updatedCard = { ...cardCopy };
              
              // If moving to a GPT column, mark as processing if needed
              if (destColumn.gptAssigned && destColumn.autoTrigger) {
                updatedCard.processing = true;
              }
              
              // Insert at the specified position
              destCards.splice(destination.index, 0, updatedCard);
              newData[boardIndex].columns[destColumnIndex].cards = destCards;
            }
          }
          
          return newData;
        });
        
        // Make the actual API request
        await apiRequest("PATCH", `/api/cards/${cardId}/move`, {
          destinationColumnId: destColId,
          position: destination.index,
        });
        
        // If the destination column has a GPT assigned and auto-trigger is enabled
        if (destColumn.gptAssigned && destColumn.autoTrigger) {
          toast({
            title: "GPT Processing",
            description: `Card will be processed by ${destColumn.gptName}`,
          });
          
          // Set up a timer to check for updates and refresh the board data
          const checkProcessingStatus = () => {
            const timer = setInterval(async () => {
              try {
                const response = await fetch(`/api/cards/${cardId}/processing-status`);
                const data = await response.json();
                
                // If processing is complete, stop checking and refresh data
                if (!data.processing) {
                  clearInterval(timer);
                  // Quietly refetch to update the data without disrupting the UI
                  queryClient.refetchQueries({ queryKey: [`/api/boards`] });
                }
              } catch (err) {
                console.error("Error checking processing status:", err);
              }
            }, 1000);
            
            // Stop checking after 30 seconds as a failsafe
            setTimeout(() => clearInterval(timer), 30000);
          };
          
          // Start checking after a short delay
          setTimeout(checkProcessingStatus, 500);
        } else {
          // Quietly refetch data in the background after a short delay
          setTimeout(() => {
            queryClient.refetchQueries({ queryKey: [`/api/boards`] });
          }, 1000);
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to move card",
          variant: "destructive",
        });
        // Refresh the data to revert to the correct state if the operation failed
        queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
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
      // Find the card and columns
      const sourceColumn = columns.find(col => col.id === sourceColumnId);
      const destColumn = columns.find(col => col.id === destinationColumnId);
      
      if (!sourceColumn || !destColumn) return;
      
      // Find the card that's being moved
      const movedCard = sourceColumn.cards.find(card => card.id === cardId);
      if (!movedCard) return;
      
      // Create a copy of the card for the destination column
      const cardCopy = { ...movedCard, columnId: destinationColumnId };
      
      // Optimistically update local query data to avoid UI flickering
      queryClient.setQueryData([`/api/boards`], (oldData: any) => {
        if (!oldData) return oldData;
        
        // Create deep copy of the data to avoid mutating the cache directly
        const newData = JSON.parse(JSON.stringify(oldData));
        
        // Find the board
        const boardIndex = newData.findIndex((b: any) => b.id === board.id);
        if (boardIndex !== -1) {
          // Remove the card from source column
          const sourceColumnIndex = newData[boardIndex].columns.findIndex(
            (col: any) => col.id === sourceColumnId
          );
          if (sourceColumnIndex !== -1) {
            newData[boardIndex].columns[sourceColumnIndex].cards = 
              newData[boardIndex].columns[sourceColumnIndex].cards.filter(
                (c: any) => c.id !== cardId
              );
          }
          
          // Add the card to destination column at the top (position 0)
          const destColumnIndex = newData[boardIndex].columns.findIndex(
            (col: any) => col.id === destinationColumnId
          );
          if (destColumnIndex !== -1) {
            const destCards = [...newData[boardIndex].columns[destColumnIndex].cards];
            
            // Update card's column ID
            const updatedCard = { ...cardCopy };
            
            // If moving to a GPT column, mark as processing if needed
            if (destColumn.gptAssigned && destColumn.autoTrigger) {
              updatedCard.processing = true;
            }
            
            // Insert at the top (position 0)
            destCards.unshift(updatedCard);
            newData[boardIndex].columns[destColumnIndex].cards = destCards;
          }
        }
        
        return newData;
      });
      
      // Close the modal immediately after the optimistic update
      handleCloseCardModal();
      
      // Make the actual API request
      await apiRequest("PATCH", `/api/cards/${cardId}/move`, {
        destinationColumnId,
        position: 0, // Place at the top of the destination column
      });
      
      // If the destination column has a GPT assigned and auto-trigger is enabled
      if (destColumn?.gptAssigned && destColumn?.autoTrigger) {
        toast({
          title: "GPT Processing",
          description: `Card will be processed by ${destColumn.gptName}`,
        });
        
        // Set up a timer to check for updates and refresh the board data
        const checkProcessingStatus = () => {
          const timer = setInterval(async () => {
            try {
              const response = await fetch(`/api/cards/${cardId}/processing-status`);
              const data = await response.json();
              
              // If processing is complete, stop checking and refresh data
              if (!data.processing) {
                clearInterval(timer);
                // Quietly refetch to update the data without disrupting the UI
                queryClient.refetchQueries({ queryKey: [`/api/boards`] });
              }
            } catch (err) {
              console.error("Error checking processing status:", err);
            }
          }, 1000);
          
          // Stop checking after 30 seconds as a failsafe
          setTimeout(() => clearInterval(timer), 30000);
        };
        
        // Start checking after a short delay
        setTimeout(checkProcessingStatus, 500);
      } else {
        // Quietly refetch data in the background after a short delay
        setTimeout(() => {
          queryClient.refetchQueries({ queryKey: [`/api/boards`] });
        }, 1000);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to move card",
        variant: "destructive",
      });
      // Refresh the data to revert to the correct state if the operation failed
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
    }
  };

  return (
    <div className="w-full">
      <DragDropContext onDragEnd={dndContext.onDragEnd}>
        {/* Horizontal scrolling container */}
        <div className="flex flex-nowrap gap-4 pb-6 overflow-x-auto min-w-full">
          {columns.map((column, index) => (
            <Column
              key={column.id}
              column={column}
              index={index}
              onCardClick={handleCardClick}
              onDeleteColumn={handleDeleteColumn}
            />
          ))}
          <AddColumn boardId={board.id} />
          {/* Add more padding at the end to ensure there's room on the right */}
          <div className="w-4 flex-shrink-0"></div>
        </div>
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
