import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useModalContext } from '@/contexts/ModalContext';

/**
 * SuggestionListener Component
 * 
 * This component listens for custom events triggered by the network interceptor
 * when a card is moved between columns and a suggestion is available.
 * It handles displaying toast notifications and opening the suggestion modal.
 */
export function SuggestionListener() {
  const { toast } = useToast();
  const { openInSuggestionMode } = useModalContext();

  useEffect(() => {
    // Handler for the custom event
    const handleSuggestionEvent = (event: CustomEvent<{ columnId: number; cardId: number; columnName: string }>) => {
      const { columnId, cardId, columnName } = event.detail;
      
      console.log(`[Prompt Assistant] Received suggestion event for column ${columnId}, card ${cardId}, name ${columnName}`);
      
      // Show a toast notification with an action button
      toast({
        title: "Prompt Assistant",
        description: `We have suggestions to improve the "${columnName}" column's instructions based on recent card activity.`,
        action: (
          <ToastAction 
            altText="View suggestion" 
            onClick={() => openInSuggestionMode(columnId, cardId)}
          >
            View
          </ToastAction>
        ),
        duration: 10000, // 10 seconds
      });
    };

    // Add event listener
    window.addEventListener('promptAssistantSuggestion', handleSuggestionEvent as EventListener);

    // Clean up
    return () => {
      window.removeEventListener('promptAssistantSuggestion', handleSuggestionEvent as EventListener);
    };
  }, [toast, openInSuggestionMode]);

  // This component doesn't render anything
  return null;
}