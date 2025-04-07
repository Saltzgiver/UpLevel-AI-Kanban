import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Chat, Attachment } from "@shared/schema";

interface ProcessingStatus {
  processing: boolean;
  gptOutput: string | null;
  chats: Chat[];
  attachments: Attachment[];
}

/**
 * Hook to monitor processing status of a card
 * Automatically polls for updates while processing
 */
export function useCardProcessing(cardId: number) {
  const queryClient = useQueryClient();
  const [isPolling, setIsPolling] = useState(false);
  
  // Query for processing status
  const { data, isLoading, error } = useQuery<ProcessingStatus>({
    queryKey: [`/api/cards/${cardId}/processing-status`],
    enabled: Boolean(cardId),
    // Only refetch on window focus if not already polling
    refetchOnWindowFocus: !isPolling,
    // Use a consistent stale time
    staleTime: 2000,
  });

  // Handle polling while processing
  useEffect(() => {
    // Start polling if card is processing
    if (data?.processing && !isPolling) {
      setIsPolling(true);
      
      // Check status more frequently (1 second) for better responsiveness
      const intervalId = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/cards/${cardId}/processing-status`] });
      }, 1000);
      
      return () => {
        clearInterval(intervalId);
        setIsPolling(false);
      };
    }
    
    // Stop polling if processing is complete
    if (!data?.processing && isPolling) {
      setIsPolling(false);
      
      // Refetch board data to update the card info in the main view
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
    }
    
    return undefined;
  }, [data?.processing, isPolling, cardId, queryClient]);
  
  // Single initial fetch when the hook is first used
  useEffect(() => {
    // Only do an initial fetch, don't start polling
    queryClient.invalidateQueries({ queryKey: [`/api/cards/${cardId}/processing-status`] });
    
    // Set up focus listener to update when the window regains focus
    const handleFocus = () => {
      // Don't update if we're already actively polling
      if (!isPolling) {
        queryClient.invalidateQueries({ queryKey: [`/api/cards/${cardId}/processing-status`] });
      }
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [cardId, queryClient, isPolling]);

  return {
    isProcessing: data?.processing || false,
    gptOutput: data?.gptOutput || null,
    chats: data?.chats || [],
    attachments: data?.attachments || [],
    isLoading,
    error,
  };
}