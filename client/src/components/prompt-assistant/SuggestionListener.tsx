import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useModalContext } from '@/contexts/ModalContext';
import { ToastAction } from '@/components/ui/toast';

/**
 * This component listens for custom events from the fetch interceptor
 * and shows toast notifications when suggestions are available.
 * It connects the network-level interceptor with the React components.
 */
export function SuggestionListener() {
  const { toast } = useToast();
  const { openInSuggestionMode } = useModalContext();

  useEffect(() => {
    // Event handler function
    const handleSuggestionEvent = (event: CustomEvent) => {
      const { columnId, cardId, columnName } = event.detail;
      
      console.log(`[Prompt Assistant] Showing toast for suggestion in column ${columnName || columnId} from card ${cardId}`);
      
      // Show toast notification
      toast({
        title: "Prompt Assistant",
        description: `Suggestion available for column "${columnName || 'Column'}"`,
        action: (
          <ToastAction 
            altText="Review suggestion" 
            onClick={() => openInSuggestionMode(columnId, cardId)}
          >
            Review
          </ToastAction>
        ),
      });
    };

    // Register the event listener
    window.addEventListener('promptAssistantSuggestion', handleSuggestionEvent as EventListener);
    
    // Cleanup
    return () => {
      window.removeEventListener('promptAssistantSuggestion', handleSuggestionEvent as EventListener);
    };
  }, [toast, openInSuggestionMode]);

  // This component doesn't render anything
  return null;
}

export default SuggestionListener;