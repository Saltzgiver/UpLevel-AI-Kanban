/**
 * Test script for the Prompt Assistant feature using direct API calls
 * 
 * This script tests the API endpoints of the Prompt Assistant feature:
 * 1. Checking the suggestion status
 * 2. Getting the suggestion content
 * 3. Accepting/rejecting the suggestion
 */
import fetch from 'node-fetch';

// Sample suggestion data
const sampleSuggestion = {
  rationale: "This is a test rationale for why the prompt should be improved",
  suggestedInstructions: "Improved prompt instructions that would work better based on card activity"
};

// Test functions
async function testPromptAssistantFlow() {
  console.log("\n--------------------------------------");
  console.log("PROMPT ASSISTANT API TEST");
  console.log("--------------------------------------\n");
  
  // Test parameters
  const columnId = 9;  // GPT-enabled column with gptName = 'imager', gptColor = 'Aqua'
  const cardId = 47;   // Card "Image Generation Test" in the imager column
  
  // Use localhost for testing when running directly from the Replit environment
  const baseUrl = 'http://localhost:3000';
  console.log(`Using base URL: ${baseUrl}`);
  
  // First, insert a test suggestion into the server using HTTP API
  try {
    console.log("STEP 1: Creating a test suggestion via API");
    
    // Normally this would happen automatically when a card is moved, but for testing
    // we'll use the manual endpoint
    console.log(`Creating test suggestion for column ${columnId}, card ${cardId}`);
    const response = await fetch(`${baseUrl}/api/columns/${columnId}/prompt-suggestion/create-test/${cardId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        suggestion: sampleSuggestion
      })
    });
    
    // Check response
    if (response.ok) {
      console.log("✅ Test suggestion created successfully");
      const data = await response.json();
      console.log("API response:", data);
    } else {
      console.log("❌ Failed to create test suggestion");
      console.log("Status:", response.status, response.statusText);
    }
  } catch (error) {
    console.error("Error creating test suggestion:", error);
  }
  
  // Step 2: Test the suggestion status API endpoint
  try {
    console.log("\nSTEP 2: Testing suggestion status API");
    
    // Make a request to the status endpoint
    console.log(`Checking suggestion status via API for column ${columnId}, card ${cardId}`);
    const response = await fetch(`${baseUrl}/api/columns/${columnId}/prompt-suggestion/status/${cardId}`);
    
    // Check response
    if (response.ok) {
      const data = await response.json();
      console.log("API response:", data);
      
      if (data && data.hasSuggestion) {
        console.log("✅ API correctly reports suggestion is available");
      } else {
        console.log("❌ API failed to report suggestion availability");
      }
    } else {
      console.log("❌ Status API call failed");
      console.log("Status:", response.status, response.statusText);
    }
  } catch (error) {
    console.error("Error in suggestion status API test:", error);
  }
  
  // Step 3: Test fetching the full suggestion
  try {
    console.log("\nSTEP 3: Testing suggestion content API");
    
    // Make a request to get the full suggestion
    console.log(`Fetching suggestion content via API for column ${columnId}, card ${cardId}`);
    const response = await fetch(`${baseUrl}/api/columns/${columnId}/prompt-suggestion/${cardId}`);
    
    // Check response
    if (response.ok) {
      const data = await response.json();
      console.log("API response:", data);
      
      if (data && data.suggestion && data.suggestion.rationale) {
        console.log("✅ API correctly returns suggestion content");
      } else {
        console.log("❌ API failed to return suggestion content");
      }
    } else {
      console.log("❌ Suggestion content API call failed");
      console.log("Status:", response.status, response.statusText);
    }
  } catch (error) {
    console.error("Error in suggestion content API test:", error);
  }
  
  // Step 4: Test accepting the suggestion
  try {
    console.log("\nSTEP 4: Testing suggestion acceptance API");
    
    // Make a request to accept the suggestion
    console.log(`Accepting suggestion via API for column ${columnId}, card ${cardId}`);
    const response = await fetch(`${baseUrl}/api/columns/${columnId}/prompt-suggestion/accept/${cardId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    // Check response
    if (response.ok) {
      const data = await response.json();
      console.log("API response:", data);
      console.log("✅ Suggestion was accepted successfully");
    } else {
      console.log("❌ Suggestion acceptance API call failed");
      console.log("Status:", response.status, response.statusText);
    }
  } catch (error) {
    console.error("Error in suggestion acceptance API test:", error);
  }
  
  console.log("\nTest complete");
}

// Run the tests
testPromptAssistantFlow().catch(console.error);