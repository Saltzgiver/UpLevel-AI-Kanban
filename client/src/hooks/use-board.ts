import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useModalContext } from "@/contexts/ModalContext";
import { useEffect, useState, useCallback } from "react";

// Interface for tracking polling state
interface PollingState {
  columnId: number;
  cardId: number;
  sourceColumnName?: string;
  active: boolean;
}

export function useBoard(boardId: number) {
  const { toast } = useToast();
  const [pollingState, setPollingState] = useState<PollingState | null>(null);
  const { openInSuggestionMode } = useModalContext();
  
  const boardQuery = useQuery({
    queryKey: [`/api/boards/${boardId}`],
    enabled: !!boardId,
  });

  // Function to manually check for suggestions (for debugging or testing)
  const checkSuggestion = useCallback(async (columnId: number, cardId: number) => {
    try {
      console.log(`[MANUAL_CHECK] Checking suggestion for column ${columnId}, card ${cardId}`);
      const statusUrl = `/api/columns/${columnId}/prompt-suggestion/status/${cardId}`;
      const response = await fetch(statusUrl);
      const data = await response.json();
      console.log(`[MANUAL_CHECK] Response:`, data);
      
      if (data.hasSuggestion) {
        // Show toast
        toast({
          title: "Prompt Assistant",
          description: `Suggestion available for column`,
          action: (
            <ToastAction 
              altText="Review suggestion" 
              onClick={() => openInSuggestionMode(columnId, cardId)}
            >
              Review
            </ToastAction>
          ),
        });
      }
      
      return data;
    } catch (error) {
      console.error('[MANUAL_CHECK] Error checking suggestion:', error);
      return { hasSuggestion: false };
    }
  }, [toast, openInSuggestionMode]);
  
  // Poll for suggestion status if polling is active
  useEffect(() => {
    if (!pollingState || !pollingState.active) return;
    
    const { columnId, cardId, sourceColumnName } = pollingState;
    let attemptCount = 0;
    const maxAttempts = 10;
    
    console.log(`[POLLING_EFFECT] Running for pollingState:`, pollingState);
    
    const intervalId = setInterval(async () => {
      console.log(`[POLLING_ATTEMPT] Polling attempt ${attemptCount + 1}/${maxAttempts} for column ${columnId}, card ${cardId}...`);
      const statusUrl = `/api/columns/${columnId}/prompt-suggestion/status/${cardId}`;
      console.log(`[POLLING_ATTEMPT] Fetching URL: ${statusUrl}`);
      
      attemptCount++;
      
      try {
        // Check if a suggestion is available
        const response = await fetch(statusUrl);
        const data = await response.json();
        
        console.log(`[POLLING_ATTEMPT] Received status response:`, data);
        
        if (data.hasSuggestion) {
          // Stop polling and show toast
          console.log(`[POLLING_SUCCESS] Suggestion found! Calling toast notification.`);
          clearInterval(intervalId);
          setPollingState(prev => prev ? { ...prev, active: false } : null);
          
          toast({
            title: "Prompt Assistant",
            description: `Suggestion available for column "${sourceColumnName || 'Column'}"`,
            action: (
              <ToastAction 
                altText="Review suggestion" 
                onClick={() => openInSuggestionMode(columnId, cardId)}
              >
                Review
              </ToastAction>
            ),
          });
        } else if (data.hasSuggestion === false) {
          console.log(`[POLLING_NO_SUGGESTION] Backend confirmed no suggestion available.`);
          
          if (attemptCount >= maxAttempts) {
            // Max attempts reached, stop polling
            console.log(`[POLLING_TIMEOUT] Max polling attempts (${maxAttempts}) reached. Stopping poll.`);
            clearInterval(intervalId);
            setPollingState(prev => prev ? { ...prev, active: false } : null);
          }
        } else {
          console.log(`[POLLING_CONTINUE] Suggestion status is undefined or still processing. Polling again soon...`);
        }
      } catch (error) {
        console.error(`[POLLING_ERROR] Error during polling attempt ${attemptCount}:`, error);
        clearInterval(intervalId);
        setPollingState(prev => prev ? { ...prev, active: false } : null);
      }
    }, 2000);
    
    // Clean up interval on unmount or when polling state changes
    return () => {
      console.log(`[POLLING_CLEANUP] Clearing polling interval ID: ${intervalId} for column ${pollingState?.columnId}, card ${pollingState?.cardId}`);
      clearInterval(intervalId);
    };
  }, [pollingState, toast, openInSuggestionMode]);

  const createColumn = useMutation({
    mutationFn: async (data: { name: string }) => {
      return apiRequest("POST", `/api/columns`, {
        name: data.name,
        boardId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${boardId}`] });
      toast({
        title: "Success",
        description: "Column created",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create column",
        variant: "destructive",
      });
    },
  });

  const updateColumn = useMutation({
    mutationFn: async (data: { id: number; name: string }) => {
      return apiRequest("PATCH", `/api/columns/${data.id}`, {
        name: data.name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${boardId}`] });
      toast({
        title: "Success",
        description: "Column updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update column",
        variant: "destructive",
      });
    },
  });

  const deleteColumn = useMutation({
    mutationFn: async (columnId: number) => {
      return apiRequest("DELETE", `/api/columns/${columnId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${boardId}`] });
      toast({
        title: "Success",
        description: "Column deleted",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete column",
        variant: "destructive",
      });
    },
  });

  const createCard = useMutation({
    mutationFn: async (data: { title: string; columnId: number }) => {
      return apiRequest("POST", `/api/cards`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${boardId}`] });
      toast({
        title: "Success",
        description: "Card created",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create card",
        variant: "destructive",
      });
    },
  });

  const updateCard = useMutation({
    mutationFn: async (data: { id: number; title?: string; description?: string }) => {
      return apiRequest("PATCH", `/api/cards/${data.id}`, {
        title: data.title,
        description: data.description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${boardId}`] });
      toast({
        title: "Success",
        description: "Card updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update card",
        variant: "destructive",
      });
    },
  });

  const deleteCard = useMutation({
    mutationFn: async (cardId: number) => {
      return apiRequest("DELETE", `/api/cards/${cardId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${boardId}`] });
      toast({
        title: "Success",
        description: "Card deleted",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete card",
        variant: "destructive",
      });
    },
  });

  const moveCard = useMutation({
    mutationFn: async (data: { 
      cardId: number; 
      sourceColumnId: number; 
      destinationColumnId: number;
      position?: number;
    }) => {
      return apiRequest("PATCH", `/api/cards/${data.cardId}/move`, {
        destinationColumnId: data.destinationColumnId,
        sourceColumnId: data.sourceColumnId, // Add source column ID for prompt improvement analysis
        position: data.position || 0,
      });
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${boardId}`] });
      
      console.log(`[MOVE_CARD_SUCCESS] Card ID: ${data.cardId}, Source Column ID: ${data.sourceColumnId}, Destination Column ID: ${data.destinationColumnId}`);
      console.log(`[MOVE_CARD_SUCCESS] Attempting to find source column data...`);
      
      // Check if the source column was GPT-enabled by finding it in the board data
      const columns = boardQuery.data?.columns || [];
      const sourceColumn = columns.find((col: any) => col.id === data.sourceColumnId);
      
      console.log(`[MOVE_CARD_SUCCESS] Found source column data:`, sourceColumn ? {
        id: sourceColumn.id,
        name: sourceColumn.name,
        gptAssigned: sourceColumn.gptAssigned,
        gptName: sourceColumn.gptName
      } : 'Not Found');
      
      if (sourceColumn?.gptAssigned) {
        // Start polling for suggestion availability
        console.log(`[POLLING_INIT] Source column ${data.sourceColumnId} is GPT-enabled. Initializing polling state for card ${data.cardId}.`);
        setPollingState({
          columnId: data.sourceColumnId,
          cardId: data.cardId,
          sourceColumnName: sourceColumn.name,
          active: true
        });
      } else {
        console.log(`[POLLING_INIT] Source column ${data.sourceColumnId} is NOT GPT-enabled or not found. Skipping polling.`);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to move card",
        variant: "destructive",
      });
    },
  });

  const assignGPTToColumn = useMutation({
    mutationFn: async (data: { 
      columnId: number; 
      gptName: string;
      apiKey?: string;
      instructions?: string;
      autoTrigger?: boolean;
    }) => {
      return apiRequest("PATCH", `/api/columns/${data.columnId}/assign-gpt`, {
        gptAssigned: true,
        gptName: data.gptName,
        apiKey: data.apiKey,
        gptInstructions: data.instructions,
        autoTrigger: data.autoTrigger
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${boardId}`] });
      toast({
        title: "Success",
        description: "GPT assigned to column",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign GPT",
        variant: "destructive",
      });
    },
  });

  const triggerGPTProcessing = useMutation({
    mutationFn: async (cardId: number) => {
      return apiRequest("POST", `/api/cards/${cardId}/trigger-gpt`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${boardId}`] });
      toast({
        title: "Success",
        description: "GPT processing triggered",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to trigger GPT processing",
        variant: "destructive",
      });
    },
  });

  return {
    board: boardQuery.data,
    isLoading: boardQuery.isLoading,
    createColumn,
    updateColumn,
    deleteColumn,
    createCard,
    updateCard,
    deleteCard,
    moveCard,
    assignGPTToColumn,
    triggerGPTProcessing,
  };
}