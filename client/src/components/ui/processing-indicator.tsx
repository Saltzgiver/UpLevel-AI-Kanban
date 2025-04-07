import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface ProcessingIndicatorProps {
  isProcessing: boolean;
  isTimedOut?: boolean;
  error?: string | null;
  onReset?: () => void;
  compact?: boolean;
}

/**
 * A unified component for displaying GPT processing states
 * This provides a consistent way to show:
 * - Active processing state with spinner
 * - Timed out processing with refresh option
 * - Error state with error message and retry option
 * - Compact mode for card display vs full mode for modal
 */
export function ProcessingIndicator({
  isProcessing,
  isTimedOut = false,
  error = null,
  onReset,
  compact = false
}: ProcessingIndicatorProps) {
  // Don't show anything if there's no processing, timeout, or error
  if (!isProcessing && !isTimedOut && !error) {
    return null;
  }

  // Compact version for cards
  if (compact) {
    if (isProcessing) {
      return (
        <div className="bg-yellow-50 border border-yellow-100 rounded p-1.5 mb-2 text-xs">
          <div className="flex items-center text-yellow-700">
            <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            AI is processing...
          </div>
        </div>
      );
    }

    if (isTimedOut) {
      return (
        <div className="bg-amber-50 border border-amber-100 rounded p-1.5 mb-2 text-xs">
          <div className="flex items-center text-amber-700">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Processing timed out
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 border border-red-100 rounded p-1.5 mb-2 text-xs">
          <div className="flex items-center text-red-700">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Processing error
          </div>
        </div>
      );
    }

    return null;
  }

  // Full version for modals
  return (
    <div 
      className={`rounded-md border p-3 mb-2 flex items-start ${
        isProcessing ? 'bg-yellow-50 border-yellow-200' :
        isTimedOut ? 'bg-amber-50 border-amber-200' :
        error ? 'bg-red-50 border-red-200' : 
        'bg-gray-50 border-gray-200'
      }`}
    >
      <div className="flex-1">
        {isProcessing && (
          <div className="flex items-center">
            <svg className="animate-spin h-4 w-4 mr-2 text-yellow-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div>
              <div className="font-medium text-yellow-800">Processing with AI</div>
              <div className="text-sm text-yellow-700">Please wait, the AI is processing your request...</div>
            </div>
          </div>
        )}
        
        {isTimedOut && (
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2 text-amber-700" />
            <div>
              <div className="font-medium text-amber-800">Processing Timeout</div>
              <div className="text-sm text-amber-700">
                The AI is taking longer than expected. You can wait for it to complete or reset the process.
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2 text-red-700" />
            <div>
              <div className="font-medium text-red-800">Processing Error</div>
              <div className="text-sm text-red-700">
                {error || "There was an error processing your request with the AI."}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Only show reset button for timeouts and errors when onReset is provided */}
      {(isTimedOut || error) && onReset && (
        <Button 
          variant="outline" 
          size="sm" 
          className={`ml-2 shrink-0 ${
            isTimedOut ? 'border-amber-200 text-amber-700 hover:bg-amber-50' :
            'border-red-200 text-red-700 hover:bg-red-50'
          }`} 
          onClick={(e) => {
            e.stopPropagation();
            onReset();
          }}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      )}
    </div>
  );
}