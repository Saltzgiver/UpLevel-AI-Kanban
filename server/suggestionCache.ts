/**
 * Suggestion Cache Module
 * 
 * Provides temporary storage for prompt suggestions when a card is moved from a GPT-enabled column.
 * This allows the frontend to check if a suggestion is available and retrieve it later.
 */

interface SuggestionData {
  cardId: number;
  hasSuggestion: boolean;
  suggestion: string | null;
  timestamp: number;
}

// TTL (Time-To-Live) in milliseconds - 5 minutes default
const CACHE_TTL = 5 * 60 * 1000; 

// Map to store column suggestions: columnId -> SuggestionData
const suggestionCache = new Map<number, SuggestionData>();

/**
 * Store a suggestion in the cache
 */
export function storeSuggestion(columnId: number, cardId: number, suggestion: string | null): void {
  suggestionCache.set(columnId, {
    cardId,
    hasSuggestion: !!suggestion,
    suggestion,
    timestamp: Date.now()
  });
  
  console.log(`Suggestion cache updated for column ${columnId}: Has Suggestion: ${!!suggestion}`);
}

/**
 * Check if a suggestion is available for a column and card
 */
export function checkSuggestion(columnId: number, cardId?: number): { hasSuggestion: boolean, suggestion?: string | null } | undefined {
  const data = suggestionCache.get(columnId);
  
  // No data found
  if (!data) {
    return undefined;
  }
  
  // Check if expired
  if (Date.now() - data.timestamp > CACHE_TTL) {
    suggestionCache.delete(columnId);
    return undefined;
  }
  
  // If cardId is provided, make sure it matches
  if (cardId !== undefined && data.cardId !== cardId) {
    return undefined;
  }
  
  return {
    hasSuggestion: data.hasSuggestion,
    suggestion: data.suggestion
  };
}

/**
 * Clear a suggestion from the cache
 */
export function clearSuggestion(columnId: number): void {
  suggestionCache.delete(columnId);
}

/**
 * Get the cache TTL in milliseconds
 */
export function getCacheTTL(): number {
  return CACHE_TTL;
}