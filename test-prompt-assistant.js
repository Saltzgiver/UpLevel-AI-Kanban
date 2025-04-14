/**
 * Test script for the Prompt Assistant feature
 * 
 * This script tests the complete Prompt Assistant flow:
 * 1. Moving a card from a GPT-enabled column
 * 2. Getting a suggestion for the prompt
 * 3. Testing the accept/reject functionality
 */

import fetch from 'node-fetch';
import { storeSuggestion, checkSuggestion, clearSuggestion, dumpCache } from './server/suggestionCache.ts';

// Sample suggestion data
const sampleSuggestion = {
  rationale: "This is a test rationale for why the prompt should be improved",
  suggestedInstructions: "Improved prompt instructions that would work better based on card activity"
};

// Test functions
async function testPromptAssistantFlow() {
  console.log("\n--------------------------------------");
  console.log("PROMPT ASSISTANT FEATURE TEST");
  console.log("--------------------------------------\n");
  
  // Step 1: Test suggestion caching
  try {
    console.log("STEP 1: Testing suggestion cache");
    
    // Store a test suggestion
    const columnId = 1;
    const cardId = 123;
    
    console.log(`Storing suggestion for column ${columnId}, card ${cardId}`);
    storeSuggestion(columnId, cardId, sampleSuggestion);
    
    // Check if the suggestion is available
    const status = checkSuggestion(columnId, cardId);
    console.log("Suggestion status:", status);
    
    if (status && status.hasSuggestion) {
      console.log("✅ Suggestion successfully stored and retrieved");
    } else {
      console.log("❌ Failed to store or retrieve suggestion");
    }
    
    // Dump the cache for debugging
    console.log("\nCurrent cache state:");
    dumpCache();
  } catch (error) {
    console.error("Error in suggestion cache test:", error);
  }
  
  // Step 2: Test the suggestion status API endpoint
  try {
    console.log("\nSTEP 2: Testing suggestion status API");
    
    // Make a request to the status endpoint
    const columnId = 1;
    const cardId = 123;
    
    console.log(`Checking suggestion status via API for column ${columnId}, card ${cardId}`);
    const response = await fetch(`http://localhost:3000/api/columns/${columnId}/prompt-suggestion/status/${cardId}`);
    const data = await response.json();
    
    console.log("API response:", data);
    
    if (data && data.hasSuggestion) {
      console.log("✅ API correctly reports suggestion is available");
    } else {
      console.log("❌ API failed to report suggestion availability");
    }
  } catch (error) {
    console.error("Error in suggestion status API test:", error);
  }
  
  // Step 3: Test fetching the full suggestion
  try {
    console.log("\nSTEP 3: Testing suggestion content API");
    
    // Make a request to get the full suggestion
    const columnId = 1;
    const cardId = 123;
    
    console.log(`Fetching suggestion content via API for column ${columnId}, card ${cardId}`);
    const response = await fetch(`http://localhost:3000/api/columns/${columnId}/prompt-suggestion/${cardId}`);
    const data = await response.json();
    
    console.log("API response:", data);
    
    if (data && data.suggestion && data.suggestion.rationale) {
      console.log("✅ API correctly returns suggestion content");
    } else {
      console.log("❌ API failed to return suggestion content");
    }
  } catch (error) {
    console.error("Error in suggestion content API test:", error);
  }
  
  // Step 4: Test accepting the suggestion
  try {
    console.log("\nSTEP 4: Testing suggestion acceptance API");
    
    // Make a request to accept the suggestion
    const columnId = 1;
    const cardId = 123;
    
    console.log(`Accepting suggestion via API for column ${columnId}, card ${cardId}`);
    const response = await fetch(`http://localhost:3000/api/columns/${columnId}/prompt-suggestion/accept/${cardId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    const data = await response.json();
    
    console.log("API response:", data);
    
    // Check if the suggestion has been cleared
    const status = checkSuggestion(columnId, cardId);
    
    if (!status || !status.hasSuggestion) {
      console.log("✅ Suggestion was cleared after being accepted");
    } else {
      console.log("❌ Suggestion still exists after being accepted");
    }
  } catch (error) {
    console.error("Error in suggestion acceptance API test:", error);
  }
  
  // Final cleanup
  console.log("\nCleaning up test data");
  clearSuggestion(1, 123);
  
  console.log("\nTest complete");
}

// Run the tests
testPromptAssistantFlow().catch(console.error);