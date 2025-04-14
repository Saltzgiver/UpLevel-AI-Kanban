import { useState, useEffect } from "react";
import { useModalContext } from "@/contexts/ModalContext";
import { AssignGPTModal } from "@/components/ui/assign-gpt-modal";
import { useQuery } from "@tanstack/react-query";
import { Column } from "@shared/schema";

/**
 * GlobalAssignGPTModal - A centralized modal component that listens to the ModalContext
 * This allows the modal to be opened from anywhere in the application, including from
 * toast notifications and global events.
 */
export function GlobalAssignGPTModal() {
  const { modalState, closeModal } = useModalContext();
  const { isOpen, columnId, isSuggestionMode, cardId } = modalState;
  
  // We need to fetch the column data based on the columnId
  const { data: column } = useQuery<Column>({
    queryKey: [`/api/columns/${columnId}`],
    enabled: !!columnId && isOpen,
  });

  // Don't render anything if modal isn't open or we don't have column data yet
  if (!isOpen || !column) {
    return null;
  }

  // Add empty cards array to satisfy the type expected by AssignGPTModal
  const columnWithCards = {
    ...column,
    cards: []
  };

  return (
    <AssignGPTModal
      column={columnWithCards}
      isOpen={isOpen}
      onClose={closeModal}
      isSuggestionMode={isSuggestionMode}
      cardId={cardId}
    />
  );
}