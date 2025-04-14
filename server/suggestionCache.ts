/**
 * Suggestion Cache Module
 * 
 * Provides temporary storage for prompt suggestions when a card is moved from a GPT-enabled column.
 * This allows the frontend to check if a suggestion is available and retrieve it later.
 */

type PromptSuggestion = {
  rationale: string;
  suggestedInstructions: string;
};

interface SuggestionData {
  cardId: number;
  hasSuggestion: boolean;
  suggestion: string | PromptSuggestion | null;
  timestamp: number;
}

// TTL (Time-To-Live) in milliseconds - 5 minutes default
const CACHE_TTL = 5 * 60 * 1000; 

// Map to store column suggestions: columnId -> SuggestionData
const suggestionCache = new Map<number, SuggestionData>();

/**
 * Store a suggestion in the cache
 */
export function storeSuggestion(
  columnId: number, 
  cardId: number, 
  suggestion: string | PromptSuggestion | null
): void {
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
export function checkSuggestion(columnId: number, cardId?: number): { hasSuggestion: boolean, suggestion?: string | PromptSuggestion | null } | undefined {
  const data = suggestionCache.get(columnId);
  
  console.log(`[TEST MODE] checkSuggestion called for column ${columnId}${cardId ? `, card ${cardId}` : ''}`);
  console.log(`[TEST MODE] Current cache state for column ${columnId}: ${data ? JSON.stringify({
    cardId: data.cardId,
    hasSuggestion: data.hasSuggestion,
    timestamp: new Date(data.timestamp).toISOString()
  }) : 'No data in cache'}`);
  
  // No data found
  if (!data) {
    console.log(`[TEST MODE] No suggestion data found for column ${columnId}`);
    // TESTING CHANGE: Return a test suggestion even if none exists
    return {
      hasSuggestion: true,
      suggestion: {
        rationale: "[TEST MODE] This is a test suggestion rationale created on demand when no suggestion was found",
        suggestedInstructions: "[TEST MODE] This is a test suggestion instruction created on demand when no suggestion was found"
      }
    };
  }
  
  // Check if expired
  if (Date.now() - data.timestamp > CACHE_TTL) {
    console.log(`[TEST MODE] Suggestion for column ${columnId} has expired, removing from cache`);
    suggestionCache.delete(columnId);
    // TESTING CHANGE: Return a test suggestion even if expired
    return {
      hasSuggestion: true,
      suggestion: {
        rationale: "[TEST MODE] This is a test suggestion rationale created on demand when the original suggestion expired",
        suggestedInstructions: "[TEST MODE] This is a test suggestion instruction created on demand when the original suggestion expired"
      }
    };
  }
  
  // If cardId is provided, make sure it matches
  if (cardId !== undefined && data.cardId !== cardId) {
    console.log(`[TEST MODE] Card ID mismatch: Expected ${cardId}, found ${data.cardId}`);
    // TESTING CHANGE: Return a test suggestion even if card IDs don't match
    return {
      hasSuggestion: true,
      suggestion: {
        rationale: "[TEST MODE] This is a test suggestion rationale created on demand when card IDs didn't match",
        suggestedInstructions: "[TEST MODE] This is a test suggestion instruction created on demand when card IDs didn't match"
      }
    };
  }
  
  console.log(`[TEST MODE] Valid suggestion found for column ${columnId}, card ${data.cardId}`);
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