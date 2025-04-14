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
  const timestamp = Date.now();
  
  console.log(`⭐⭐ [SUGGESTION_CACHE] STORING suggestion for column ${columnId}, card ${cardId} at ${new Date(timestamp).toISOString()}`);
  
  // Extra validation to catch potential errors
  if (isNaN(columnId) || columnId <= 0) {
    console.error(`⚠️ [SUGGESTION_CACHE] Invalid column ID: ${columnId}`);
    return;
  }

  if (isNaN(cardId) || cardId <= 0) {
    console.error(`⚠️ [SUGGESTION_CACHE] Invalid card ID: ${cardId}`);
    return;
  }
  
  // Store in cache
  suggestionCache.set(columnId, {
    cardId,
    hasSuggestion: !!suggestion,
    suggestion,
    timestamp
  });
  
  // Detailed logging about what was stored
  if (suggestion) {
    if (typeof suggestion === 'string') {
      console.log(`⭐ [SUGGESTION_CACHE] Stored TEXT suggestion for column ${columnId}, card ${cardId}`);
      console.log(`⭐ [SUGGESTION_CONTENT] Preview: "${suggestion.substring(0, 100)}${suggestion.length > 100 ? '...' : ''}"`);
    } else if (suggestion && typeof suggestion === 'object') {
      console.log(`⭐ [SUGGESTION_CACHE] Stored OBJECT suggestion for column ${columnId}, card ${cardId}`);
      console.log(`⭐ [SUGGESTION_RATIONALE] "${suggestion.rationale.substring(0, 100)}${suggestion.rationale.length > 100 ? '...' : ''}"`);
      console.log(`⭐ [SUGGESTION_INSTRUCTIONS] "${suggestion.suggestedInstructions.substring(0, 100)}${suggestion.suggestedInstructions.length > 100 ? '...' : ''}"`);
    }
  } else {
    console.log(`⭐ [SUGGESTION_CACHE] Stored NULL suggestion (no improvement needed) for column ${columnId}, card ${cardId}`);
  }
  
  // Log all current cache entries
  console.log(`⭐⭐ [SUGGESTION_CACHE_STATUS] Cache now has ${suggestionCache.size} entries`);
  suggestionCache.forEach((data, colId) => {
    const ageSeconds = (Date.now() - data.timestamp) / 1000;
    console.log(`⭐ [CACHE_ENTRY] Column ${colId} - Card ${data.cardId} - Has suggestion: ${data.hasSuggestion} - Age: ${ageSeconds.toFixed(1)}s - Expires in: ${((CACHE_TTL / 1000) - ageSeconds).toFixed(1)}s`);
  });
}

/**
 * Check if a suggestion is available for a column and card
 */
export function checkSuggestion(columnId: number, cardId?: number): { hasSuggestion: boolean, suggestion?: string | PromptSuggestion | null } | undefined {
  const now = Date.now();
  console.log(`⭐⭐ [SUGGESTION_CHECK] Checking for suggestion in column ${columnId}${cardId ? `, card ${cardId}` : ''} at ${new Date(now).toISOString()}`);
  
  // Extra validation to catch potential errors
  if (isNaN(columnId) || columnId <= 0) {
    console.error(`⚠️ [SUGGESTION_CHECK] Invalid column ID: ${columnId}`);
    return { hasSuggestion: false };
  }

  if (cardId !== undefined && (isNaN(cardId) || cardId <= 0)) {
    console.error(`⚠️ [SUGGESTION_CHECK] Invalid card ID: ${cardId}`);
    return { hasSuggestion: false };
  }
  
  const data = suggestionCache.get(columnId);
  
  // No data found
  if (!data) {
    console.log(`⭐ [SUGGESTION_CHECK] NO DATA found in cache for column ${columnId}`);
    return undefined;
  }
  
  // Check if expired
  const ageMs = now - data.timestamp;
  if (ageMs > CACHE_TTL) {
    console.log(`⭐ [SUGGESTION_CHECK] EXPIRED suggestion for column ${columnId} (${(ageMs / 1000).toFixed(1)}s old, TTL: ${CACHE_TTL/1000}s)`);
    suggestionCache.delete(columnId);
    return undefined;
  }
  
  // If cardId is provided, make sure it matches
  if (cardId !== undefined && data.cardId !== cardId) {
    console.log(`⭐ [SUGGESTION_CHECK] CARD MISMATCH for column ${columnId} (cached card: ${data.cardId}, requested card: ${cardId})`);
    return undefined;
  }
  
  console.log(`⭐ [SUGGESTION_CHECK] FOUND valid suggestion for column ${columnId}, has content: ${data.hasSuggestion}, age: ${(ageMs / 1000).toFixed(1)}s`);
  
  // Extra debug info for found suggestions
  if (data.hasSuggestion && data.suggestion) {
    if (typeof data.suggestion === 'string') {
      console.log(`⭐ [SUGGESTION_CONTENT] Returning TEXT suggestion, length: ${data.suggestion.length} chars`);
    } else if (data.suggestion && typeof data.suggestion === 'object') {
      console.log(`⭐ [SUGGESTION_CONTENT] Returning OBJECT suggestion with rationale of ${data.suggestion.rationale.length} chars`);
    }
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
  // Extra validation to catch potential errors
  if (isNaN(columnId) || columnId <= 0) {
    console.error(`⚠️ [SUGGESTION_CLEAR] Invalid column ID: ${columnId}`);
    return;
  }
  
  const hadSuggestion = suggestionCache.has(columnId);
  let suggestionInfo = "unknown";
  
  // Get info about what we're clearing for better logs
  if (hadSuggestion) {
    const data = suggestionCache.get(columnId);
    if (data) {
      suggestionInfo = `card ${data.cardId}, hasSuggestion: ${data.hasSuggestion}, age: ${((Date.now() - data.timestamp) / 1000).toFixed(1)}s`;
    }
  }
  
  // Delete from cache
  suggestionCache.delete(columnId);
  
  console.log(`⭐⭐ [SUGGESTION_CLEAR] Cleared cache entry for column ${columnId}, ${hadSuggestion ? `suggestion was present (${suggestionInfo})` : 'no suggestion was present'}`);
}

/**
 * Get the cache TTL in milliseconds
 */
export function getCacheTTL(): number {
  return CACHE_TTL;
}