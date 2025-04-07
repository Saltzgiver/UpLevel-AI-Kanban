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
    // Don't refetch on window focus to avoid interrupting the polling
    refetchOnWindowFocus: false,
    // Shorter stale time for real-time processing updates
    staleTime: 1000,
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
  
  // Always start a brief polling period when the hook is first used or when component using it gets focus
  // This ensures we catch any messages that were added since the last time the component was active
  useEffect(() => {
    const pollBriefly = () => {
      // Poll every second for 5 seconds
      let pollCount = 0;
      const intervalId = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/cards/${cardId}/processing-status`] });
        pollCount++;
        if (pollCount >= 5) {
          clearInterval(intervalId);
        }
      }, 1000);
      
      return intervalId;
    };
    
    // Initial poll when hook is mounted
    const initialPollId = pollBriefly();
    
    // Set up focus listener to poll when the window regains focus
    const handleFocus = () => {
      // Don't start a new poll if we're already actively polling
      if (!isPolling) {
        pollBriefly();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(initialPollId);
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