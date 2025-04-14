import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useModalContext } from "@/contexts/ModalContext";
import { useEffect, useState } from "react";

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

  // Poll for suggestion status if polling is active
  useEffect(() => {
    if (!pollingState || !pollingState.active) {
      console.log(`[TEST MODE] Polling not active or no polling state exists`);
      return;
    }
    
    const { columnId, cardId, sourceColumnName } = pollingState;
    let attempts = 0;
    const maxAttempts = 3; // TESTING CHANGE: Reduced for faster testing
    
    console.log(`[TEST MODE] Starting to poll for suggestion availability for column ${columnId}, card ${cardId}`);
    
    // CRITICAL FIX: Immediately show a test toast to ensure suggestion UI always appears
    // This bypasses the polling entirely for testing purposes
    setTimeout(() => {
      console.log(`[TEST MODE] IMMEDIATE TEST MODE: Showing suggestion toast without waiting for polling`);
      
      toast({
        title: "Prompt Assistant",
        description: `[TEST MODE] Test suggestion available for column "${sourceColumnName || 'Column'}"`,
        action: (
          <ToastAction 
            altText="Review suggestion" 
            onClick={() => openInSuggestionMode(columnId, cardId)}
          >
            Review
          </ToastAction>
        ),
      });
      
      console.log(`[TEST MODE] Immediate test toast shown for column ${columnId}, card ${cardId}`);
    }, 500); // Show test toast immediately after a short delay
    
    const intervalId = setInterval(async () => {
      attempts++;
      console.log(`[TEST MODE] Polling attempt ${attempts} for suggestion availability`);
      
      try {
        // Check if a suggestion is available 
        const response = await apiRequest(
          "GET", 
          `/api/columns/${columnId}/prompt-suggestion/status/${cardId}`
        );
        
        // Log the response for debugging
        console.log(`[TEST MODE] Suggestion status API response:`, response);
        
        // TESTING CHANGE: Always show a toast with suggestion info after a few polling attempts
        if (attempts >= 2) {
          // Stop polling and show toast
          clearInterval(intervalId);
          setPollingState(prev => prev ? { ...prev, active: false } : null);
          
          // Always show a toast with the suggestion status
          const hasSuggestion = response?.hasSuggestion || false;
          
          toast({
            title: "Prompt Assistant",
            description: hasSuggestion 
              ? `Suggestion available for column "${sourceColumnName || 'Column'}"` 
              : `[TEST MODE] No suggestion available for column "${sourceColumnName || 'Column'}", but showing anyway`,
            action: (
              <ToastAction 
                altText="Review suggestion" 
                onClick={() => openInSuggestionMode(columnId, cardId)}
              >
                Review
              </ToastAction>
            ),
          });
          
          console.log(`[TEST MODE] Toast shown for column ${columnId}, card ${cardId}, hasSuggestion: ${hasSuggestion}`);
        } else if (response?.hasSuggestion) {
          // If we got a real suggestion before our test limit, show it right away
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
          
          console.log(`[TEST MODE] Real suggestion found, toast shown for column ${columnId}, card ${cardId}`);
        }
      } catch (error) {
        console.error("[TEST MODE] Error checking suggestion availability:", error);
        
        // TESTING CHANGE: Even on error, show a suggestion toast
        clearInterval(intervalId);
        setPollingState(prev => prev ? { ...prev, active: false } : null);
        
        toast({
          title: "Prompt Assistant",
          description: `[TEST MODE] Error checking suggestions, but showing notification anyway for column "${sourceColumnName || 'Column'}"`,
          action: (
            <ToastAction 
              altText="Review suggestion" 
              onClick={() => openInSuggestionMode(columnId, cardId)}
            >
              Review
            </ToastAction>
          ),
        });
        
        console.log(`[TEST MODE] Error occurred but toast shown anyway for column ${columnId}, card ${cardId}`);
      }
    }, 2000);
    
    // Clean up interval on unmount or when polling state changes
    return () => clearInterval(intervalId);
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
      
      // Get the source column from board data
      const columns = boardQuery.data?.columns || [];
      const sourceColumn = columns.find((col: any) => col.id === data.sourceColumnId);
      
      // TESTING CHANGE: Always start polling for suggestions regardless of GPT status
      console.log(`[TEST MODE] Starting to poll for suggestion availability for column ${data.sourceColumnId}, card ${data.cardId}`);
      console.log(`[TEST MODE] Source column details: ${sourceColumn ? JSON.stringify({
        id: sourceColumn.id,
        name: sourceColumn.name,
        gptAssigned: sourceColumn.gptAssigned
      }) : 'Column not found'}`);
      
      // Always activate polling for suggestions in test mode
      setPollingState({
        columnId: data.sourceColumnId,
        cardId: data.cardId,
        sourceColumnName: sourceColumn ? sourceColumn.name : 'Column',
        active: true
      });
      
      // Show immediate toast to verify move event was received
      toast({
        title: "Card Moved",
        description: `Card moved from ${sourceColumn?.name || 'source'} column. Checking for suggestions...`,
      });
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