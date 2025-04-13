import { create } from 'zustand';

// Define the store state interface
interface ColumnSettingsModalState {
  isOpen: boolean;
  columnId: number | null;
  isSuggestionMode: boolean;
  cardId: number | null;
  
  // Actions
  openModal: (columnId: number) => void;
  openInSuggestionMode: (columnId: number, cardId: number) => void;
  closeModal: () => void;
}

// Create the store with initial state and actions
export const useColumnSettingsModalStore = create<ColumnSettingsModalState>((set: any) => ({
  isOpen: false,
  columnId: null,
  isSuggestionMode: false,
  cardId: null,
  
  // Open the modal normally (configure mode)
  openModal: (columnId: number) => set({ 
    isOpen: true, 
    columnId, 
    isSuggestionMode: false,
    cardId: null
  }),
  
  // Open the modal in suggestion review mode
  openInSuggestionMode: (columnId: number, cardId: number) => set({ 
    isOpen: true, 
    columnId, 
    isSuggestionMode: true,
    cardId
  }),
  
  // Close the modal
  closeModal: () => set({ 
    isOpen: false,
    isSuggestionMode: false,
    // Keep columnId and cardId for potential reopening
  })
}));