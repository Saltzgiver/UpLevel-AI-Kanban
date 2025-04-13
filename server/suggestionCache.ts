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
  console.log(`⭐ SUGGESTION CACHE: Storing suggestion for column ${columnId}, card ${cardId}`);
  
  suggestionCache.set(columnId, {
    cardId,
    hasSuggestion: !!suggestion,
    suggestion,
    timestamp: Date.now()
  });
  
  // More detailed logging
  if (suggestion) {
    if (typeof suggestion === 'string') {
      console.log(`⭐ SUGGESTION CACHE: Stored text suggestion (${suggestion.substring(0, 50)}...)`);
    } else if (suggestion && typeof suggestion === 'object') {
      console.log(`⭐ SUGGESTION CACHE: Stored object suggestion with rationale: ${suggestion.rationale.substring(0, 50)}...`);
    }
  } else {
    console.log(`⭐ SUGGESTION CACHE: Stored empty suggestion (null)`);
  }
  
  // Log all current cache entries
  console.log(`⭐ SUGGESTION CACHE STATUS: Current cache has ${suggestionCache.size} entries`);
  suggestionCache.forEach((data, colId) => {
    console.log(`⭐ SUGGESTION CACHE: Column ${colId} - Card ${data.cardId} - Has suggestion: ${data.hasSuggestion} - Age: ${(Date.now() - data.timestamp) / 1000}s`);
  });
}

/**
 * Check if a suggestion is available for a column and card
 */
export function checkSuggestion(columnId: number, cardId?: number): { hasSuggestion: boolean, suggestion?: string | PromptSuggestion | null } | undefined {
  console.log(`⭐ SUGGESTION CACHE: Checking for suggestion in column ${columnId}${cardId ? `, card ${cardId}` : ''}`);
  
  const data = suggestionCache.get(columnId);
  
  // No data found
  if (!data) {
    console.log(`⭐ SUGGESTION CACHE: No suggestion found for column ${columnId}`);
    return undefined;
  }
  
  // Check if expired
  if (Date.now() - data.timestamp > CACHE_TTL) {
    console.log(`⭐ SUGGESTION CACHE: Suggestion for column ${columnId} expired (${(Date.now() - data.timestamp) / 1000}s old)`);
    suggestionCache.delete(columnId);
    return undefined;
  }
  
  // If cardId is provided, make sure it matches
  if (cardId !== undefined && data.cardId !== cardId) {
    console.log(`⭐ SUGGESTION CACHE: Card ID mismatch for column ${columnId} (cached: ${data.cardId}, requested: ${cardId})`);
    return undefined;
  }
  
  console.log(`⭐ SUGGESTION CACHE: Found suggestion for column ${columnId}, has content: ${data.hasSuggestion}`);
  
  return {
    hasSuggestion: data.hasSuggestion,
    suggestion: data.suggestion
  };
}

/**
 * Clear a suggestion from the cache
 */
export function clearSuggestion(columnId: number): void {
  const hadSuggestion = suggestionCache.has(columnId);
  suggestionCache.delete(columnId);
  console.log(`⭐ SUGGESTION CACHE: Cleared suggestion for column ${columnId}, ${hadSuggestion ? 'suggestion was present' : 'no suggestion was present'}`);
}

/**
 * Get the cache TTL in milliseconds
 */
export function getCacheTTL(): number {
  return CACHE_TTL;
}