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
 * 
 * Note: The processing state display has been removed per user request
 */
export function ProcessingIndicator({
  isProcessing,
  isTimedOut = false,
  error = null,
  onReset,
  compact = false
}: ProcessingIndicatorProps) {
  // Always return null now - we've removed the processing indicator
  return null;
}