/**
 * Test script for the Prompt Assistant API endpoints
 * 
 * This script makes HTTP requests to test the suggestion API endpoints
 */

// Using built-in fetch for Node.js v18+

async function testSuggestionEndpoints() {
  console.log('=== TESTING SUGGESTION API ENDPOINTS ===');
  
  // Test column and card IDs for testing
  const testColumnId = 999;
  const testCardId = 888;
  
  // Base URL for API requests
  const baseUrl = 'http://localhost:3000';
  
  try {
    // Test 1: Check suggestion status (when none exists)
    console.log(`\nTest 1: Checking suggestion status for column ${testColumnId}`);
    const statusResponse = await fetch(`${baseUrl}/api/columns/${testColumnId}/prompt-suggestion/status`);
    const statusData = await statusResponse.json();
    console.log(`Status response: ${JSON.stringify(statusData)}`);
    
    // Test 2: Check suggestion status for specific card
    console.log(`\nTest 2: Checking suggestion status for column ${testColumnId} and card ${testCardId}`);
    const cardStatusResponse = await fetch(`${baseUrl}/api/columns/${testColumnId}/prompt-suggestion/status/${testCardId}`);
    const cardStatusData = await cardStatusResponse.json();
    console.log(`Status response for card: ${JSON.stringify(cardStatusData)}`);
    
    console.log('\nTests completed!');
    console.log('=== END TESTING ===');
  } catch (error) {
    console.error('Error during API tests:', error);
  }
}

// Run the tests
testSuggestionEndpoints();