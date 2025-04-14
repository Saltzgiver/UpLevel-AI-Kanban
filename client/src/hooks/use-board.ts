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

  // Helper function to show suggestion toast (define before other functions that use it)
  const showSuggestionToast = useCallback((columnId: number, cardId: number, columnName?: string) => {
    console.log(`[TOAST_DEBUG] Starting to create toast for column ${columnId}, card ${cardId}`);
    console.log(`[TOAST_DEBUG] toast type = ${typeof toast}, openInSuggestionMode type = ${typeof openInSuggestionMode}`);
    
    // Create a unique ID for tracking this specific toast
    const toastId = `suggestion-${columnId}-${cardId}-${Date.now()}`;
    
    try {
      // Use multiple approaches to ensure toast appears
      // 1. Standard toast with onClick handler - don't specify ID, it's generated automatically
      const { dismiss } = toast({
        title: "🔍 Prompt Improvement Available!",
        description: `We analyzed cards from "${columnName || 'Column'}" and have suggestions to improve the prompt. Click to review.`,
        duration: 60000, // Show for 60 seconds - much longer than default
        onClick: () => {
          console.log(`[TOAST_CLICK] Toast clicked for column ${columnId}, card ${cardId}`);
          openInSuggestionMode(columnId, cardId);
          dismiss(); // Dismiss toast when clicked
        }
      });
      
      console.log(`[TOAST_SUCCESS] Created toast with ID ${toastId} for column ${columnId}`);
      
      // 2. Also automatically open the modal after a delay as a fallback
      console.log(`[MODAL_FALLBACK] Setting up automatic modal opening as fallback in 3 seconds`);
      setTimeout(() => {
        console.log(`[MODAL_FALLBACK] Automatically opening suggestion modal for column ${columnId}, card ${cardId}`);
        openInSuggestionMode(columnId, cardId);
      }, 3000);
      
      // 3. Also show a second toast after a longer delay (in case first one was missed)
      setTimeout(() => {
        console.log(`[TOAST_BACKUP] Showing second suggestion notification for column ${columnId}, card ${cardId}`);
        toast({
          title: "Prompt Suggestion Ready",
          description: `A suggestion is available for column "${columnName || 'Column'}". Opening now...`,
          duration: 3000,
        });
      }, 15000);
      
    } catch (error) {
      console.error(`[TOAST_ERROR] Error creating toast:`, error);
      
      // If toast creation fails completely, alert and open modal directly
      console.warn(`[TOAST_FAILURE] Toast creation failed, using alert() as fallback`);
      alert(`Prompt improvement suggestion available! Opening suggestion view.`);
      
      // Open suggestion modal immediately as ultimate fallback
      openInSuggestionMode(columnId, cardId);
    }
    
    // Return the toast ID for tracking
    return toastId;
  }, [toast, openInSuggestionMode]);

  // Function to check for suggestions with improved error handling
  const checkSuggestion = useCallback(async (columnId: number, cardId: number) => {
    // Create a unique ID for this specific check for logging
    const checkId = `check-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    try {
      console.log(`[CHECK_${checkId}] 🔍 Checking suggestion for column ${columnId}, card ${cardId}`);
      
      // Validate input parameters
      if (!columnId || isNaN(columnId) || columnId <= 0) {
        console.error(`[CHECK_${checkId}] ⚠️ Invalid column ID: ${columnId}`);
        return { hasSuggestion: false, error: "Invalid column ID" };
      }
      
      if (!cardId || isNaN(cardId) || cardId <= 0) {
        console.error(`[CHECK_${checkId}] ⚠️ Invalid card ID: ${cardId}`);
        return { hasSuggestion: false, error: "Invalid card ID" };
      }
      
      // Use the specific endpoint for prompt suggestions with cache prevention
      const statusUrl = `/api/columns/${columnId}/prompt-suggestion/status/${cardId}?_=${Date.now()}`;
      console.log(`[CHECK_${checkId}] 🌐 Fetching URL: ${statusUrl}`);
      
      const response = await fetch(statusUrl, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[CHECK_${checkId}] ❌ Server returned ${response.status}: ${errorText}`);
        return { 
          hasSuggestion: false, 
          error: `Server error: ${response.status}`,
          details: errorText
        };
      }
      
      // Verify the content type is JSON to avoid parsing non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error(`[CHECK_${checkId}] ❌ Expected JSON, but got ${contentType}`);
        return { 
          hasSuggestion: false, 
          error: `Invalid content type: ${contentType}`
        };
      }
      
      const data = await response.json();
      console.log(`[CHECK_${checkId}] 📊 Response:`, data);
      
      // More detailed checks on the response data
      if (data && typeof data === 'object') {
        // Verify hasSuggestion is present and is an actual boolean
        if (typeof data.hasSuggestion !== 'boolean') {
          console.error(`[CHECK_${checkId}] ⚠️ Missing or invalid hasSuggestion field:`, data.hasSuggestion);
          return { 
            hasSuggestion: false, 
            error: "Invalid response format"
          };
        }
        
        // If we have a suggestion, show toast and verify the content
        if (data.hasSuggestion === true) {
          console.log(`[CHECK_${checkId}] ✅ Suggestion found, showing toast notification`);
          
          // Get the source column name from the response if available
          const columnName = data.columnName || data.sourceColumnName || null;
          
          // Show toast notification
          showSuggestionToast(columnId, cardId, columnName);
          
          // Add extra debug info to the response
          return {
            ...data,
            _debug: {
              checkedAt: new Date().toISOString(),
              checkId,
              toastShown: true
            }
          };
        } else {
          // No suggestion available yet
          console.log(`[CHECK_${checkId}] ℹ️ No suggestion available yet`);
          return {
            ...data,
            _debug: {
              checkedAt: new Date().toISOString(),
              checkId,
              toastShown: false
            }
          };
        }
      } else {
        // Invalid response format
        console.error(`[CHECK_${checkId}] ⚠️ Invalid response format:`, data);
        return { 
          hasSuggestion: false, 
          error: "Invalid response format"
        };
      }
    } catch (error) {
      console.error(`[CHECK_${checkId}] ❌ Error checking suggestion:`, error);
      return { 
        hasSuggestion: false, 
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }, [showSuggestionToast]);

  // Function to start polling for a suggestion
  const startPollingForSuggestion = useCallback((columnId: number, cardId: number, columnName?: string) => {
    console.log(`[POLLING_START] 🔄 Starting suggestion polling for column ${columnId}, card ${cardId}, source: ${columnName || 'unknown'}`);
    
    // Validate parameters
    if (!columnId || isNaN(columnId) || columnId <= 0) {
      console.error(`[POLLING_ERROR] ⚠️ Invalid column ID: ${columnId}. Cannot start polling.`);
      return;
    }
    
    if (!cardId || isNaN(cardId) || cardId <= 0) {
      console.error(`[POLLING_ERROR] ⚠️ Invalid card ID: ${cardId}. Cannot start polling.`);
      return;
    }
    
    // Start a new polling session
    const pollingId = `poll-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    console.log(`[POLLING_${pollingId}] ✅ Starting new polling session for column ${columnId}, card ${cardId}`);
    
    // Set polling state to activate the useEffect
    setPollingState({
      columnId,
      cardId,
      sourceColumnName: columnName,
      active: true
    });
    
    // Also try checking immediately as an optimization
    setTimeout(() => {
      console.log(`[POLLING_${pollingId}] 🔍 Performing immediate first check`);
      checkSuggestion(columnId, cardId);
    }, 1000);
  }, [checkSuggestion]);
  
  // Define type for board query
  type BoardData = {
    id: number;
    name: string;
    columns: Array<{
      id: number;
      name: string;
      gptAssigned?: boolean;
      gptName?: string;
      cards?: any[];
    }>;
  };
  
  const boardQuery = useQuery<BoardData>({
    queryKey: [`/api/boards/${boardId}`],
    enabled: !!boardId,
  });

  // Helper function to create toast notification with review action
  
  // Poll for suggestion status if polling is active
  useEffect(() => {
    if (!pollingState || !pollingState.active) return;
    
    const { columnId, cardId, sourceColumnName } = pollingState;
    let attemptCount = 0;
    const maxAttempts = 15; // Increase max attempts to allow more time for suggestions
    
    console.log(`[POLLING_EFFECT] 🔄 STARTED for column ${columnId}, card ${cardId}, source column: ${sourceColumnName || 'unknown'}`);
    
    const intervalId = setInterval(async () => {
      console.log(`[POLLING_ATTEMPT] 📊 Attempt ${attemptCount + 1}/${maxAttempts} for column ${columnId}, card ${cardId}...`);
      
      // Ensure we're using the card-specific endpoint
      const statusUrl = `/api/columns/${columnId}/prompt-suggestion/status/${cardId}`;
      
      // Force timestamp parameter to avoid caching
      const timestampedUrl = `${statusUrl}?t=${Date.now()}`;
      console.log(`[POLLING_ATTEMPT] 🔍 Fetching URL: ${timestampedUrl}`);
      
      attemptCount++;
      
      try {
        // Check if a suggestion is available with proper headers to prevent caching
        const response = await fetch(timestampedUrl, {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[POLLING_FETCH_ERROR] ❌ Server returned ${response.status}: ${errorText}`);
          
          // If the card or column doesn't exist, stop polling
          if (response.status === 404) {
            console.log(`[POLLING_STOP] ⛔ Received 404, stopping polling`);
            clearInterval(intervalId);
            setPollingState(prev => prev ? { ...prev, active: false } : null);
            return;
          }
          
          throw new Error(`Server returned ${response.status}: ${errorText}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error(`[POLLING_ERROR] ❌ Expected JSON, but got ${contentType}`);
          throw new Error(`Expected JSON, but got ${contentType}`);
        }
        
        const data = await response.json();
        console.log(`[POLLING_RESPONSE] 📡 Data from poll attempt ${attemptCount}:`, data);
        
        // Check if we have a valid suggestion
        if (data && data.hasSuggestion === true) {
          console.log(`[POLLING_SUCCESS] ✅ SUGGESTION FOUND for column ${columnId}, card ${cardId}. Showing toast...`);
          
          // Double-verify the suggestion exists by fetching the actual content
          try {
            const contentUrl = `/api/columns/${columnId}/prompt-suggestion`;
            const timestampedContentUrl = `${contentUrl}?t=${Date.now()}`; // Add cache-busting parameter
            console.log(`[POLLING_VERIFICATION] 🔍 Verifying suggestion content from ${timestampedContentUrl}`);
            
            // Use the same headers as in the status check to ensure consistency
            const contentResponse = await fetch(timestampedContentUrl, {
              headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
              }
            });
            
            if (contentResponse.ok) {
              const contentType = contentResponse.headers.get('content-type');
              
              // Verify content type to avoid parsing non-JSON responses
              if (!contentType || !contentType.includes('application/json')) {
                console.error(`[POLLING_CONTENT_ERROR] ❌ Expected JSON content, but got ${contentType}`);
                throw new Error(`Expected JSON content, but got ${contentType}`);
              }
              
              const contentData = await contentResponse.json();
              
              // Extra verification to ensure the content has the expected structure
              if (!contentData || !contentData.suggestedInstructions) {
                console.error(`[POLLING_CONTENT_ERROR] ❌ Missing expected content data:`, contentData);
                throw new Error(`Missing expected content fields in response`);
              }
              
              console.log(`[POLLING_VERIFICATION] ✅ Suggestion content verified, instruction length: ${contentData.suggestedInstructions.length} chars`);
              
              // Show toast notification - with extra logging
              console.log(`[TOAST_TRIGGER] 🔔 Triggering toast notification for suggestion from ${sourceColumnName || 'unknown'}`);
              const toastId = showSuggestionToast(columnId, cardId, sourceColumnName);
              console.log(`[TOAST_TRIGGER] ✅ Toast triggered with ID: ${toastId}`);
              
              // Stop polling after suggestion is found and toast is shown
              console.log(`[POLLING_STOP] ✅ Suggestion confirmed and notification shown, stopping polling`);
              clearInterval(intervalId);
              setPollingState(prev => prev ? { ...prev, active: false } : null);
              
              // Return early to prevent further processing
              return;
            } else {
              // Get error message for better logging
              let errorMessage = "Unknown error";
              try {
                const errorData = await contentResponse.text();
                errorMessage = errorData || `Status code: ${contentResponse.status}`;
              } catch (e) {
                errorMessage = `Status code: ${contentResponse.status}`;
              }
              
              console.error(`[POLLING_VERIFICATION] ❌ Suggestion content verification failed: ${errorMessage}`);
              
              // Special handling for 404 (no suggestion available)
              if (contentResponse.status === 404) {
                console.log(`[POLLING_VERIFICATION] ℹ️ Suggestion was found in status check but not available when fetching content. Will continue polling.`);
              }
              
              // Continue polling - this may be a temporary issue
              console.log(`[POLLING_CONTINUE] ⏳ Continuing polling despite content verification failure`);
            }
          } catch (contentError) {
            console.error(`[POLLING_VERIFICATION] ❌ Error verifying suggestion content:`, contentError);
            // Continue polling - this could be a network issue
            console.log(`[POLLING_CONTINUE] ⏳ Continuing polling after error during content verification`);
          }
        } else if (data && data.hasSuggestion === false) { // Explicit check for false
          console.log(`[POLLING_NO_SUGGESTION] ℹ️ Backend confirmed NO SUGGESTION available.`);
          
          if (attemptCount >= maxAttempts) {
            // Max attempts reached, stop polling
            console.log(`[POLLING_TIMEOUT] ⏱️ Max polling attempts (${maxAttempts}) reached. Stopping poll.`);
            clearInterval(intervalId);
            setPollingState(prev => prev ? { ...prev, active: false } : null);
          }
        } else {
          console.log(`[POLLING_CONTINUE] ⏳ Waiting for suggestion processing to complete. Polling again soon...`);
        }
      } catch (error) {
        console.error(`[POLLING_ERROR] ❌ Error during polling attempt ${attemptCount}:`, error);
        
        // Only stop on the last attempt or on serious errors to avoid stopping due to temporary network issues
        if (attemptCount >= maxAttempts - 2) {
          console.log(`[POLLING_STOP] ⛔ Stopping polling due to repeated errors`);
          clearInterval(intervalId);
          setPollingState(prev => prev ? { ...prev, active: false } : null);
        }
      }
    }, 2000);
    
    // Clean up interval on unmount or when polling state changes
    return () => {
      console.log(`[POLLING_CLEANUP] 🧹 Cleaning up interval for column ${pollingState?.columnId}, card ${pollingState?.cardId}`);
      clearInterval(intervalId);
    };
  }, [pollingState, showSuggestionToast]);

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
      
      console.log(`[MOVE_CARD_SUCCESS] ✅ Card ${data.cardId} moved from column ${data.sourceColumnId} to ${data.destinationColumnId}`);
      
      // Only start polling if we have both a source column ID and a card ID
      if (!data.sourceColumnId || !data.cardId) {
        console.log(`[POLLING_SKIP] ⚠️ Missing required data for polling. sourceColumnId: ${data.sourceColumnId}, cardId: ${data.cardId}`);
        return;
      }
      
      // Check if the source column was GPT-enabled by finding it in the board data
      const columns = boardQuery.data?.columns || [];
      const sourceColumn = columns.find((col: any) => col.id === data.sourceColumnId);
      
      console.log(`[MOVE_CARD_SUCCESS] 🔍 Source column:`, sourceColumn ? {
        id: sourceColumn.id,
        name: sourceColumn.name,
        gptAssigned: sourceColumn.gptAssigned,
        gptName: sourceColumn.gptName
      } : 'Not Found');
      
      // Only initiate polling if the source column is GPT-enabled
      if (sourceColumn?.gptAssigned) {
        console.log(`[POLLING_INIT] 🚀 Starting polling for suggestions - column ${data.sourceColumnId} (${sourceColumn.name}) is GPT-enabled`);
        
        // Add a small delay before starting polling to allow backend processing to begin
        setTimeout(() => {
          // Start polling for suggestion availability 
          startPollingForSuggestion(data.sourceColumnId, data.cardId, sourceColumn.name);
        }, 500);
      } else {
        console.log(`[POLLING_SKIP] ℹ️ Source column ${data.sourceColumnId} is not GPT-enabled or not found. Skipping polling.`);
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
    checkSuggestion, // Manual check function for debugging
    startPollingForSuggestion, // Manual polling trigger for debugging
    // Debug function to directly show a toast - exposed for testing
    directToastTest: () => {
      console.log('[DEBUG_TOAST] Manually triggering toast notification directly');
      
      // Try direct toast
      try {
        toast({
          title: "Test Notification",
          description: "This is a test toast to verify the notification system works.",
          duration: 60000
        });
        console.log('[DEBUG_TOAST] Direct toast triggered successfully');
      } catch (error) {
        console.error('[DEBUG_TOAST] Direct toast failed:', error);
      }
      
      // Also try via the suggestion helper after a delay
      setTimeout(() => {
        try {
          console.log('[DEBUG_TOAST] Attempting via suggestion helper');
          const columnId = boardQuery.data?.columns?.[0]?.id || 1;
          const cardId = 1;
          showSuggestionToast(columnId, cardId, "Test Column");
          console.log('[DEBUG_TOAST] Suggestion toast triggered');
        } catch (error) {
          console.error('[DEBUG_TOAST] Suggestion toast failed:', error);
        }
      }, 2000);
    }
  };
}