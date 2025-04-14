/**
 * Enhanced Suggestion Cache Module
 * 
 * Provides temporary storage for prompt suggestions when a card is moved from a GPT-enabled column.
 * This allows the frontend to check if a suggestion is available and retrieve it later.
 * 
 * This improved version uses a composite key (columnId + cardId) to ensure suggestions
 * are properly tracked for each card movement.
 */

type PromptSuggestion = {
  rationale: string;
  suggestedInstructions: string;
};

interface SuggestionData {
  cardId: number;
  columnId: number;
  hasSuggestion: boolean;
  suggestion: string | PromptSuggestion | null;
  timestamp: number;
}

// TTL (Time-To-Live) in milliseconds - 5 minutes default
const CACHE_TTL = 5 * 60 * 1000; 

// Map to store suggestions using a composite key (columnId_cardId -> SuggestionData)
const suggestionCache = new Map<string, SuggestionData>();

// Helper to generate a unique cache key
function getCacheKey(columnId: number, cardId?: number): string {
  return cardId ? `${columnId}_${cardId}` : `${columnId}`;
}

/**
 * Store a suggestion in the cache
 */
export function storeSuggestion(
  columnId: number, 
  cardId: number, 
  suggestion: string | PromptSuggestion | null
): void {
  const cacheKey = getCacheKey(columnId, cardId);
  
  // Store with detailed information
  suggestionCache.set(cacheKey, {
    columnId, 
    cardId,
    hasSuggestion: !!suggestion,
    suggestion,
    timestamp: Date.now()
  });
  
  console.log(`[PROMPT ASSISTANT] Suggestion cache updated - Key: ${cacheKey}, Has Suggestion: ${!!suggestion}`);
  if (suggestion) {
    console.log(`[PROMPT ASSISTANT] Suggestion content set for key ${cacheKey}`);
  }
  
  // For backward compatibility, also store by column ID only
  const columnKey = getCacheKey(columnId);
  suggestionCache.set(columnKey, {
    columnId,
    cardId,
    hasSuggestion: !!suggestion,
    suggestion,
    timestamp: Date.now()
  });
  console.log(`[PROMPT ASSISTANT] Column cache updated - Key: ${columnKey}`);
}

/**
 * Check if a suggestion is available for a column and card
 */
export function checkSuggestion(columnId: number, cardId?: number): { hasSuggestion: boolean, suggestion?: string | PromptSuggestion | null } | undefined {
  // First try the specific card suggestion if cardId is provided
  if (cardId !== undefined) {
    const specificKey = getCacheKey(columnId, cardId);
    console.log(`[PROMPT ASSISTANT] Checking suggestion with specific key: ${specificKey}`);
    
    const specificData = suggestionCache.get(specificKey);
    if (specificData) {
      // Check if expired
      if (Date.now() - specificData.timestamp > CACHE_TTL) {
        console.log(`[PROMPT ASSISTANT] Suggestion expired for key: ${specificKey}`);
        suggestionCache.delete(specificKey);
      } else {
        console.log(`[PROMPT ASSISTANT] Found suggestion for key: ${specificKey}, hasSuggestion: ${specificData.hasSuggestion}`);
        return {
          hasSuggestion: specificData.hasSuggestion,
          suggestion: specificData.suggestion
        };
      }
    } else {
      console.log(`[PROMPT ASSISTANT] No suggestion found for specific key: ${specificKey}`);
    }
  }
  
  // Fall back to column-only suggestion
  const columnKey = getCacheKey(columnId);
  console.log(`[PROMPT ASSISTANT] Checking suggestion with column key: ${columnKey}`);
  
  const columnData = suggestionCache.get(columnKey);
  if (!columnData) {
    console.log(`[PROMPT ASSISTANT] No suggestion found for column key: ${columnKey}`);
    return undefined;
  }
  
  // Check if expired
  if (Date.now() - columnData.timestamp > CACHE_TTL) {
    console.log(`[PROMPT ASSISTANT] Suggestion expired for column key: ${columnKey}`);
    suggestionCache.delete(columnKey);
    return undefined;
  }
  
  // If cardId is provided, make sure it matches
  if (cardId !== undefined && columnData.cardId !== cardId) {
    console.log(`[PROMPT ASSISTANT] Card ID mismatch - Expected: ${cardId}, Found: ${columnData.cardId}`);
    return undefined;
  }
  
  console.log(`[PROMPT ASSISTANT] Found suggestion for column key: ${columnKey}, hasSuggestion: ${columnData.hasSuggestion}`);
  return {
    hasSuggestion: columnData.hasSuggestion,
    suggestion: columnData.suggestion
  };
}

/**
 * Clear a suggestion from the cache
 */
export function clearSuggestion(columnId: number, cardId?: number): void {
  if (cardId !== undefined) {
    // Clear specific card suggestion
    const specificKey = getCacheKey(columnId, cardId);
    suggestionCache.delete(specificKey);
    console.log(`[PROMPT ASSISTANT] Cleared suggestion for key: ${specificKey}`);
  }
  
  // Always clear column-level suggestion
  const columnKey = getCacheKey(columnId);
  suggestionCache.delete(columnKey);
  console.log(`[PROMPT ASSISTANT] Cleared suggestion for column key: ${columnKey}`);
}

/**
 * Dump the current cache contents (for debugging)
 */
export function dumpCache(): void {
  console.log('[PROMPT ASSISTANT] Current suggestion cache contents:');
  suggestionCache.forEach((value, key) => {
    console.log(`  Key: ${key}, Column: ${value.columnId}, Card: ${value.cardId}, Has Suggestion: ${value.hasSuggestion}`);
  });
}

/**
 * Get the cache TTL in milliseconds
 */
export function getCacheTTL(): number {
  return CACHE_TTL;
}