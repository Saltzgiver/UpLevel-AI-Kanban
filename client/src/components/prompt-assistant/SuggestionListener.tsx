import { useEffect } from 'react';
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

  useEffect(() => {
    console.log('[SuggestionListener] Component mounted');
    
    // Handler for the custom event
    const handleSuggestionEvent = async (e: Event) => {
      const event = e as CustomEvent<{ columnId: number; cardId: number; columnName: string }>;
      const { columnId, cardId, columnName } = event.detail;
      
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
        
        // Create a more descriptive message for the toast - without the rationale
        let descriptionContent = "";
        
        // Add a few key do's (max 2)
        if (dos.length > 0) {
          descriptionContent += `<div class="mb-2">
            <div class="flex items-center gap-1.5 font-semibold text-emerald-500 dark:text-emerald-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
                <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clip-rule="evenodd" />
              </svg>
              <span>Do's:</span>
            </div>
            <ul class="pl-2 space-y-1.5">`;
          
          // Show all do's without the "more" message
          dos.forEach(item => {
            descriptionContent += `<li class="text-sm flex items-start">
              <span class="text-emerald-400 mr-1.5">•</span>
              <span>${item.text}</span>
            </li>`;
          });
          
          descriptionContent += `</ul></div>`;
        }
        
        // Add all don'ts
        if (donts.length > 0) {
          descriptionContent += `<div>
            <div class="flex items-center gap-1.5 font-semibold text-rose-500 dark:text-rose-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
                <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clip-rule="evenodd" />
              </svg>
              <span>Don'ts:</span>
            </div>
            <ul class="pl-2 space-y-1.5">`;
            
          // Show all don'ts without the "more" message
          donts.forEach(item => {
            descriptionContent += `<li class="text-sm flex items-start">
              <span class="text-rose-400 mr-1.5">•</span>
              <span>${item.text}</span>
            </li>`;
          });
          
          descriptionContent += `</ul></div>`;
        }
        
        // Show a toast notification with both View and Accept buttons
        console.log('[SuggestionListener] Showing enhanced toast notification with View and Accept buttons');
        toast({
          title: (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center animate-pulse">
                <span className="text-white text-xs">AI</span>
              </div>
              <span>AI Prompt Suggestion</span>
            </div>
          ),
          description: (
            <div className="rounded-md border border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 p-3 shadow-inner">
              <div className="text-xs text-blue-500 dark:text-blue-400 mb-2 font-semibold">For "{columnName}" column:</div>
              <div dangerouslySetInnerHTML={{ __html: descriptionContent }} className="pl-1" />
              <div className="flex gap-2 justify-start items-center mt-4 border-t border-blue-100 dark:border-blue-800 pt-3">
                <button
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-md px-4 py-1.5 text-xs font-medium shadow-sm transition-all"
                  onClick={() => {
                    console.log(`[SuggestionListener] Accept button clicked for column ${columnId}, card ${cardId}`);
                    applySuggestion(columnId, cardId, suggestion);
                  }}
                >
                  Accept
                </button>
                <button
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-md px-4 py-1.5 text-xs font-medium shadow-sm transition-all"
                  onClick={() => {
                    console.log(`[SuggestionListener] View button clicked for column ${columnId}, card ${cardId}`);
                    openInSuggestionMode(columnId, cardId);
                  }}
                >
                  View Details
                </button>
              </div>
            </div>
          ),

          duration: 15000, // 15 seconds to give more time to read the enhanced content
        });
        console.log('[SuggestionListener] Enhanced toast notification triggered');
        
      } catch (error) {
        console.error('[SuggestionListener] Error fetching suggestion details:', error);
        
        // Fallback to basic toast if we can't fetch details, but still with AI styling
        toast({
          title: (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center animate-pulse">
                <span className="text-white text-xs">AI</span>
              </div>
              <span>AI Prompt Suggestion</span>
            </div>
          ),
          description: (
            <div className="rounded-md border border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 p-3 shadow-inner">
              <div className="text-sm mb-3">
                We have suggestions to improve the "{columnName}" column's instructions based on recent card activity.
              </div>
              <div className="flex gap-2 justify-start items-center mt-3 border-t border-blue-100 dark:border-blue-800 pt-3">
                <button
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-md px-4 py-1.5 text-xs font-medium shadow-sm transition-all"
                  onClick={() => {
                    console.log(`[SuggestionListener] View button clicked for column ${columnId}, card ${cardId}`);
                    openInSuggestionMode(columnId, cardId);
                  }}
                >
                  View Suggestions
                </button>
              </div>
            </div>
          ),
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