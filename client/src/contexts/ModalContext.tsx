import React, { createContext, useContext, useState } from 'react';

interface ColumnSettingsModalState {
  isOpen: boolean;
  columnId: number | null;
  isSuggestionMode: boolean;
  cardId: number | null;
}

interface ColumnSettingsModalContextType {
  modalState: ColumnSettingsModalState;
  openModal: (columnId: number) => void;
  openInSuggestionMode: (columnId: number, cardId: number) => void;
  closeModal: () => void;
}

const initialState: ColumnSettingsModalState = {
  isOpen: false,
  columnId: null,
  isSuggestionMode: false,
  cardId: null,
};

const ModalContext = createContext<ColumnSettingsModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<ColumnSettingsModalState>(initialState);

  const openModal = (columnId: number) => {
    setModalState({
      isOpen: true,
      columnId,
      isSuggestionMode: false,
      cardId: null,
    });
  };

  const openInSuggestionMode = (columnId: number, cardId: number) => {
    setModalState({
      isOpen: true,
      columnId,
      isSuggestionMode: true,
      cardId,
    });
  };

  const closeModal = () => {
    setModalState(prev => ({
      ...prev,
      isOpen: false,
    }));
  };

  return (
    <ModalContext.Provider value={{ modalState, openModal, openInSuggestionMode, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModalContext() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModalContext must be used within a ModalProvider');
  }
  return context;
}