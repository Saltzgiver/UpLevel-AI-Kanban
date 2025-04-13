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
    if (!pollingState || !pollingState.active) return;
    
    const { columnId, cardId, sourceColumnName } = pollingState;
    let attempts = 0;
    const maxAttempts = 10;
    
    console.log(`🔍 POLLING: Starting to poll for suggestion availability for column ${columnId}, card ${cardId}`);
    
    const intervalId = setInterval(async () => {
      attempts++;
      console.log(`🔍 POLLING: Attempt ${attempts} for suggestion availability (column ${columnId}, card ${cardId})`);
      
      try {
        // Check if a suggestion is available
        console.log(`🔍 POLLING: Sending status check request to /api/columns/${columnId}/prompt-suggestion/status/${cardId}`);
        const response = await apiRequest(
          "GET", 
          `/api/columns/${columnId}/prompt-suggestion/status/${cardId}`
        );
        
        console.log(`🔍 POLLING: Got response:`, response);
        
        if (response?.hasSuggestion) {
          // Stop polling and show toast
          console.log(`🔍 POLLING: Suggestion available! Stopping poll and showing toast`);
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
        } else if (attempts >= maxAttempts) {
          // Max attempts reached, stop polling
          console.log("No suggestion available after maximum attempts");
          clearInterval(intervalId);
          setPollingState(prev => prev ? { ...prev, active: false } : null);
        }
      } catch (error) {
        console.error("Error checking suggestion availability:", error);
        clearInterval(intervalId);
        setPollingState(prev => prev ? { ...prev, active: false } : null);
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
      
      // Check if the source column was GPT-enabled by finding it in the board data
      const columns = boardQuery.data?.columns || [];
      const sourceColumn = columns.find((col: any) => col.id === data.sourceColumnId);
      
      console.log(`🔍 MOVE CARD: Column data for source column ${data.sourceColumnId}:`, 
        sourceColumn ? {
          id: sourceColumn.id,
          name: sourceColumn.name,
          gptAssigned: sourceColumn.gptAssigned,
          gptName: sourceColumn.gptName
        } : 'not found'
      );
      
      if (sourceColumn?.gptAssigned) {
        // Start polling for suggestion availability
        console.log(`🔍 MOVE CARD: Starting polling for suggestion - column ${data.sourceColumnId}, card ${data.cardId}`);
        setPollingState({
          columnId: data.sourceColumnId,
          cardId: data.cardId,
          sourceColumnName: sourceColumn.name,
          active: true
        });
      } else {
        console.log(`🔍 MOVE CARD: Not starting polling - source column ${data.sourceColumnId} is not GPT-enabled`);
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