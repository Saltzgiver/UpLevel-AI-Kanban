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
  // Only show when actively processing - simplify the states
  if (!isProcessing) {
    return null;
  }

  // Compact version for cards - only show active processing state
  if (compact) {
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

  // Full version for modals - simplified to just show active processing
  return (
    <div className="rounded-md border p-3 mb-2 flex items-start bg-yellow-50 border-yellow-200">
      <div className="flex-1">
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
      </div>
    </div>
  );
}