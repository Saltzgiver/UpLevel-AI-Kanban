import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useModalContext } from "@/contexts/ModalContext";

interface PromptAssistantEvent extends CustomEvent {
  detail: {
    columnId: number;
    cardId: number;
    sourceColumnName: string;
  };
}

/**
 * PromptAssistantToastListener component
 * Listens for global promptAssistantSuggestion events and displays toasts in response
 * This component should be mounted at the app level to ensure suggestion toasts are shown
 * regardless of component lifecycles
 */
export function PromptAssistantToastListener() {
  const { toast } = useToast();
  const { openInSuggestionMode } = useModalContext();

  useEffect(() => {
    // Define the event handler
    const handleSuggestionEvent = (event: PromptAssistantEvent) => {
      const { columnId, cardId, sourceColumnName } = event.detail;
      
      console.log(`[Prompt Assistant] Toast Listener: Showing toast for suggestion in column "${sourceColumnName}" (${columnId}), card ${cardId}`);
      
      // Show the toast with an action button to review
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
    };
    
    // Add event listener
    window.addEventListener('promptAssistantSuggestion', handleSuggestionEvent as EventListener);
    
    // Remove event listener on cleanup
    return () => {
      window.removeEventListener('promptAssistantSuggestion', handleSuggestionEvent as EventListener);
    };
  }, [toast, openInSuggestionMode]);

  // This component doesn't render anything
  return null;
}