import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Chat, Attachment } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ProcessingStatus {
  processing: boolean;
  gptOutput: string | null;
  processingError: string | null;
  chats: Chat[];
  attachments: Attachment[];
  updatedAt?: string;
}

/**
 * Hook to monitor processing status of a card
 * Automatically polls for updates while processing
 * @param cardId - The ID of the card to monitor
 * @param isDetailView - Whether the card is being viewed in detail (modal view)
 */
export function useCardProcessing(cardId: number, isDetailView: boolean = false) {
  const queryClient = useQueryClient();
  const [processingTimeout, setProcessingTimeout] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  
  // Set a consistent timeout duration
  const PROCESSING_TIMEOUT = 60000; // 1 minute timeout
  
  // Simplified query with retries and consistent polling
  const { data, isLoading, error, isError } = useQuery<ProcessingStatus>({
    queryKey: [`/api/cards/${cardId}/processing-status`],
    enabled: Boolean(cardId),
    // Fixed polling interval while enabled
    refetchInterval: 1000, // Poll every second while the card is open
    staleTime: 500, // Shorter stale time to ensure more frequent refreshes
    retry: 3,
    retryDelay: 1000,
    // Force refetch on window focus to ensure we always have latest state
    refetchOnWindowFocus: true,
  });
  
  // Setup timeout when processing starts
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // If processing started, set up a new timeout
    if (data?.processing && !processingTimeout) {
      console.log(`Starting processing timer for card ${cardId}`);
      
      timeoutRef.current = setTimeout(() => {
        console.warn(`Processing timeout reached for card ${cardId} after ${PROCESSING_TIMEOUT}ms`);
        setProcessingTimeout(true);
        
        toast({
          title: "Processing Timeout",
          description: "The AI processing took too long and timed out. You can view any partial results or try again.",
          variant: "destructive"
        });
        
        // Force refresh data to ensure UI is updated
        queryClient.invalidateQueries({ queryKey: [`/api/cards/${cardId}/processing-status`] });
        queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      }, PROCESSING_TIMEOUT);
    }
    
    // If processing completed, clear timeout and reset state
    if (!data?.processing && !isLoading) {
      // If there was a processing error, show a toast
      if (data?.processingError) {
        console.error(`Processing error for card ${cardId}:`, data.processingError);
      }
      
      // Clear timeout if processing is complete
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // If timeout was previously set but now processing is done
      if (processingTimeout) {
        setProcessingTimeout(false);
      }
      
      // Force refresh the board data when processing completes
      // This ensures all cards get updated with the latest processing state
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data?.processing, data?.processingError, cardId, queryClient, processingTimeout, toast, isLoading]);
  
  // Function to manually reset processing state
  const resetProcessingState = useCallback(async () => {
    try {
      console.log(`Manually resetting processing state for card ${cardId}`);
      
      await apiRequest("PATCH", `/api/cards/${cardId}`, { 
        processing: false 
      });
      
      // Clear timeout and reset state
      setProcessingTimeout(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Force refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/cards/${cardId}/processing-status`] });
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      
      toast({
        title: "Processing Reset",
        description: "Processing state has been reset successfully."
      });
    } catch (e) {
      console.error("Failed to reset processing state:", e);
      toast({
        title: "Error",
        description: "Failed to reset processing state.",
        variant: "destructive"
      });
    }
  }, [cardId, queryClient, toast]);
  
  // Return a more comprehensive status object with processing state dependent on view context
  const result = {
    // Always show processing indicator for both card view and detail view
    // This allows typing indicators to appear in both views
    isProcessing: data?.processing || false,
    isProcessingTimedOut: processingTimeout,
    processingError: data?.processingError || null,
    gptOutput: data?.gptOutput || null,
    chats: data?.chats || [],
    attachments: data?.attachments || [],
    isLoading,
    error: isError ? (error instanceof Error ? error.message : "Unknown error") : null,
    resetProcessingState,
    // Add raw processing status for internal use
    rawProcessingStatus: data?.processing || false
  };
  
  return result;
}