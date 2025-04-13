/**
 * Direct test of the suggestion cache functionality
 */

// Import the suggestion cache functions using ES modules
import { storeSuggestion, checkSuggestion, clearSuggestion } from './server/suggestionCache.js';

// Test function
function testSuggestionCache() {
  console.log('=== DIRECT TESTING OF SUGGESTION CACHE ===');
  
  // Test column and card IDs
  const testColumnId = 999;
  const testCardId = 888;
  const testSuggestion = "This is a test suggestion for improving the column prompt. It should include more specific instructions about output format.";
  
  console.log(`Step 1: Store a suggestion for column ${testColumnId} from card ${testCardId}`);
  storeSuggestion(testColumnId, testCardId, testSuggestion);
  
  console.log(`Step 2: Check if suggestion is available (should be true)`);
  const status1 = checkSuggestion(testColumnId);
  console.log(`Suggestion available: ${status1?.hasSuggestion || false}`);
  console.log(`Suggestion content: ${status1?.suggestion?.substring(0, 50)}...`);
  
  console.log(`Step 3: Check if suggestion is available for specific card (should be true)`);
  const status2 = checkSuggestion(testColumnId, testCardId);
  console.log(`Suggestion available for card ${testCardId}: ${status2?.hasSuggestion || false}`);
  
  console.log(`Step 4: Check if suggestion is available for different card (should be false)`);
  const status3 = checkSuggestion(testColumnId, testCardId + 1);
  console.log(`Suggestion available for card ${testCardId + 1}: ${status3?.hasSuggestion || false}`);
  
  console.log(`Step 5: Clear the suggestion`);
  clearSuggestion(testColumnId);
  
  console.log(`Step 6: Check if suggestion is still available (should be false)`);
  const status4 = checkSuggestion(testColumnId);
  console.log(`Suggestion available after clearing: ${status4?.hasSuggestion || false}`);
  
  console.log(`Test completed successfully!`);
  console.log('=== END TESTING ===');
}

// Run the test
testSuggestionCache();