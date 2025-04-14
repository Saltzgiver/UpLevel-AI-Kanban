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
    console.log('[SuggestionListener] Component mounted');
    
    // Handler for the custom event
    const handleSuggestionEvent = (event: CustomEvent<{ columnId: number; cardId: number; columnName: string }>) => {
      const { columnId, cardId, columnName } = event.detail;
      
      console.log(`[SuggestionListener] Received suggestion event for column ${columnId}, card ${cardId}, name ${columnName}`);
      
      // Show a toast notification with an action button
      console.log('[SuggestionListener] Showing toast notification with View button');
      toast({
        title: "Prompt Assistant",
        description: `We have suggestions to improve the "${columnName}" column's instructions based on recent card activity.`,
        action: (
          <ToastAction 
            altText="View suggestion" 
            onClick={() => {
              console.log(`[SuggestionListener] View button clicked for column ${columnId}, card ${cardId}`);
              openInSuggestionMode(columnId, cardId);
            }}
          >
            View
          </ToastAction>
        ),
        duration: 10000, // 10 seconds
      });
      console.log('[SuggestionListener] Toast notification triggered');
    };

    // Test event dispatcher for debugging
    const testEvent = () => {
      console.log('[SuggestionListener] Dispatching test event');
      const event = new CustomEvent('test', { detail: { message: 'Test event received' } });
      window.dispatchEvent(event);
    };
    
    // Add both event listeners
    console.log('[SuggestionListener] Adding event listener for promptAssistantSuggestion');
    window.addEventListener('promptAssistantSuggestion', handleSuggestionEvent as EventListener);
    window.addEventListener('test', ((e: CustomEvent) => console.log(e.detail.message)) as EventListener);
    
    // Dispatch test event after a short delay
    setTimeout(testEvent, 2000);
    
    // Clean up
    return () => {
      console.log('[SuggestionListener] Component unmounting, removing event listeners');
      window.removeEventListener('promptAssistantSuggestion', handleSuggestionEvent as EventListener);
      window.removeEventListener('test', ((e: CustomEvent) => console.log(e.detail.message)) as EventListener);
    };
  }, [toast, openInSuggestionMode]);

  // This component doesn't render anything
  return null;
}