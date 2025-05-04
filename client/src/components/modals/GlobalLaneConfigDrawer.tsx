import { useState, useEffect } from "react";
import { useModalContext } from "@/contexts/ModalContext";
import { useQuery } from "@tanstack/react-query";
import { Column } from "@shared/schema";
import { LaneConfigDrawer } from "@/components/ui/lane-config-drawer";

/**
 * GlobalLaneConfigDrawer - A centralized drawer component that listens to the ModalContext
 * This allows the drawer to be opened from anywhere in the application, including from
 * toast notifications and global events.
 */
export function GlobalLaneConfigDrawer() {
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

  return (
    <LaneConfigDrawer
      column={column}
      isOpen={isOpen}
      onClose={closeModal}
      isSuggestionMode={isSuggestionMode}
      cardId={cardId}
    />
  );
}