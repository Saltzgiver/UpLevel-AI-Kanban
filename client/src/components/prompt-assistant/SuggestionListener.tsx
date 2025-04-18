import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useModalContext } from '@/contexts/ModalContext';
import { parseInstructions } from '@/components/ui/assign-gpt-modal';

/**
 * Interface for the suggestion response
 */
interface PromptSuggestion {
  rationale: string;
  suggestedInstructions: string;
}

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
  
  // Function to test toast notifications directly - disabled in production
  const testToast = () => {
    console.log('[SuggestionListener] Testing toast with action button');
    toast({
      title: "Test Toast",
      description: "This is a test toast with an action button",
      action: (
        <ToastAction 
          altText="Test Action" 
          onClick={() => {
            console.log('[SuggestionListener] Test action button clicked');
          }}
        >
          Test
        </ToastAction>
      ),
      duration: 10000,
    });
    console.log('[SuggestionListener] Test toast triggered');
  };
  
  // Test function is now disabled - uncomment for testing
  /*
  useEffect(() => {
    // Wait a moment before triggering the test toast
    setTimeout(testToast, 3000);
  }, []);
  */

  // Function to apply the suggestion directly
  const applySuggestion = async (columnId: number, cardId: number, suggestion: PromptSuggestion) => {
    try {
      console.log(`[SuggestionListener] Applying suggestion for column ${columnId}`);
      
      // Fetch current column data first
      const columnResponse = await fetch(`/api/columns/${columnId}`);
      if (!columnResponse.ok) {
        throw new Error('Failed to fetch column data');
      }
      
      const column = await columnResponse.json();
      
      // Apply the suggestion by updating the column
      const response = await fetch(`/api/columns/${columnId}/assign-gpt`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gptAssigned: true,
          gptName: column.gptName || "GPT Assistant",
          gptInstructions: suggestion.suggestedInstructions,
          gptColor: column.gptColor,
          autoTrigger: column.autoTrigger !== false
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to apply suggestion');
      }
      
      // Invalidate cache (the same way assign-gpt-modal does)
      const invalidateEvent = new CustomEvent('invalidateQueries', { 
        detail: { queryKey: ['/api/boards'] } 
      });
      window.dispatchEvent(invalidateEvent);
      
      // Show success toast
      toast({
        title: "Suggestion Applied",
        description: "The new prompt instructions have been applied successfully.",
      });
      
    } catch (error) {
      console.error('[SuggestionListener] Error applying suggestion:', error);
      toast({
        title: "Error",
        description: "Failed to apply suggestion. Please try again.",
        variant: "destructive",
      });
    }
  };

  // States for expanded view
  const [expandedDos, setExpandedDos] = useState(false);
  const [expandedDonts, setExpandedDonts] = useState(false);
  
  useEffect(() => {
    console.log('[SuggestionListener] Component mounted');
    
    // Handler for the custom event
    const handleSuggestionEvent = async (e: Event) => {
      const event = e as CustomEvent<{ columnId: number; cardId: number; columnName: string }>;
      const { columnId, cardId, columnName } = event.detail;
      
      // Reset expanded states for a new toast
      setExpandedDos(false);
      setExpandedDonts(false);
      
      console.log(`[SuggestionListener] Received suggestion event for column ${columnId}, card ${cardId}, name ${columnName}`);
      
      try {
        // Fetch the actual suggestion content
        const response = await fetch(`/api/columns/${columnId}/prompt-suggestion/${cardId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch suggestion');
        }
        
        const data = await response.json();
        if (!data.suggestion) {
          throw new Error('No suggestion found');
        }
        
        const suggestion: PromptSuggestion = data.suggestion;
        
        // Parse the instructions to extract do's and don'ts
        const { dos, donts } = parseInstructions(suggestion.suggestedInstructions);
        
        // Show a toast notification with both View and Accept buttons
        console.log('[SuggestionListener] Showing enhanced toast notification with View and Accept buttons');
        toast({
          title: `Prompt Suggestion for "${columnName}"`,
          description: (
            <div>
              {/* Do's Section */}
              {dos.length > 0 && (
                <div className="mb-2">
                  <div className="font-semibold text-emerald-500 dark:text-emerald-400 mb-1">Do's:</div>
                  <ul className="pl-2">
                    {(expandedDos ? dos : dos.slice(0, 2)).map((item, index) => (
                      <li key={`do-${index}`} className="text-sm mb-1">• {item.text}</li>
                    ))}
                    {dos.length > 2 && (
                      <li className="text-xs text-muted-foreground cursor-pointer" onClick={() => setExpandedDos(!expandedDos)}>
                        {expandedDos ? "Show less" : `Show ${dos.length - 2} more`}
                      </li>
                    )}
                  </ul>
                </div>
              )}
              
              {/* Don'ts Section */}
              {donts.length > 0 && (
                <div>
                  <div className="font-semibold text-rose-500 dark:text-rose-400 mb-1">Don'ts:</div>
                  <ul className="pl-2">
                    {(expandedDonts ? donts : donts.slice(0, 2)).map((item, index) => (
                      <li key={`dont-${index}`} className="text-sm mb-1">• {item.text}</li>
                    ))}
                    {donts.length > 2 && (
                      <li className="text-xs text-muted-foreground cursor-pointer" onClick={() => setExpandedDonts(!expandedDonts)}>
                        {expandedDonts ? "Show less" : `Show ${donts.length - 2} more`}
                      </li>
                    )}
                  </ul>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex gap-2 justify-start items-center mt-3">
                <button
                  className="bg-green-600 hover:bg-green-700 text-white rounded px-3 py-1 text-xs font-medium"
                  onClick={() => {
                    console.log(`[SuggestionListener] Accept button clicked for column ${columnId}, card ${cardId}`);
                    applySuggestion(columnId, cardId, suggestion);
                  }}
                >
                  Accept
                </button>
                <button
                  className="bg-secondary hover:bg-secondary/80 rounded px-3 py-1 text-xs font-medium"
                  onClick={() => {
                    console.log(`[SuggestionListener] View button clicked for column ${columnId}, card ${cardId}`);
                    openInSuggestionMode(columnId, cardId);
                  }}
                >
                  View
                </button>
              </div>
            </div>
          ),
          action: undefined as any,
          duration: 15000, // 15 seconds to give more time to read the enhanced content
        });
        console.log('[SuggestionListener] Enhanced toast notification triggered');
        
      } catch (error) {
        console.error('[SuggestionListener] Error fetching suggestion details:', error);
        
        // Fallback to basic toast if we can't fetch details
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
          ) as any,
          duration: 10000, // 10 seconds
        });
      }
    };

    // Test event dispatcher for debugging - disabled in production
    const testEvent = () => {
      console.log('[SuggestionListener] Dispatching test event');
      const event = new CustomEvent('test', { detail: { message: 'Test event received' } });
      window.dispatchEvent(event);
    };
    
    // Event listener for cache invalidation
    const handleInvalidateQueries = (e: Event) => {
      const event = e as CustomEvent<{ queryKey: string[] }>;
      // This would be implemented if we were using React Query directly
      // For now, we'll just log it
      console.log('[SuggestionListener] Received invalidate queries event:', event.detail);
    };
    
    // Test event handler
    const handleTestEvent = (e: Event) => {
      const event = e as CustomEvent;
      console.log(event.detail.message);
    };
    
    // Add event listeners
    console.log('[SuggestionListener] Adding event listeners');
    window.addEventListener('promptAssistantSuggestion', handleSuggestionEvent);
    window.addEventListener('test', handleTestEvent);
    window.addEventListener('invalidateQueries', handleInvalidateQueries);
    
    // Test event dispatch is disabled - uncomment for testing
    // setTimeout(testEvent, 2000);
    
    // Clean up
    return () => {
      console.log('[SuggestionListener] Component unmounting, removing event listeners');
      window.removeEventListener('promptAssistantSuggestion', handleSuggestionEvent);
      window.removeEventListener('test', handleTestEvent);
      window.removeEventListener('invalidateQueries', handleInvalidateQueries);
    };
  }, [toast, openInSuggestionMode]);

  // This component doesn't render anything
  return null;
}