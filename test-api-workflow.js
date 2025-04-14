/**
 * Simple test for the Prompt Assistant API workflow
 * This script tests the API endpoints related to the Prompt Assistant feature
 */

import fetch from 'node-fetch';

// Test column and card data
const TEST_COLUMN_ID = 12;  // Using the draft ideas column
const TEST_CARD_ID = 64;    // Pick an available card id

async function testApiWorkflow() {
  console.log("\n==================================================");
  console.log("PROMPT ASSISTANT API WORKFLOW TEST");
  console.log("==================================================\n");
  
  try {
    // Step 1: Create a test suggestion via API
    console.log("STEP 1: Creating a test suggestion via API");
    
    const createResponse = await fetch(`http://localhost:5000/api/columns/${TEST_COLUMN_ID}/prompt-suggestion/create-test/${TEST_CARD_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        suggestion: {
          rationale: "Based on analyzing user interactions with this card, the AI would benefit from more specific guidance on formatting output and handling edge cases when generating content.",
          suggestedInstructions: "Generate a short paragraph expanding on the card title and description with these improvements:\n1. Include at least 3 key points from the main topic\n2. Format with bullet points when appropriate \n3. Add a concluding sentence with a recommendation\n4. Keep the tone professional and authoritative"
        }
      }),
    });
    
    if (!createResponse.ok) {
      console.error("Error creating test suggestion:", createResponse.status, createResponse.statusText);
      const errorText = await createResponse.text();
      console.error("Error details:", errorText);
      throw new Error("Failed to create test suggestion");
    }
    
    const createResult = await createResponse.json();
    console.log("Create response:", createResult);
    console.log("✅ Test suggestion created successfully");
    
    // Step 2: Check if suggestion is available
    console.log("\nSTEP 2: Checking suggestion status via API");
    
    const statusResponse = await fetch(`http://localhost:5000/api/columns/${TEST_COLUMN_ID}/prompt-suggestion/check/${TEST_CARD_ID}`);
    if (!statusResponse.ok) {
      throw new Error(`Failed to check suggestion status: ${statusResponse.status}`);
    }
    
    const statusResult = await statusResponse.json();
    console.log("Status response:", statusResult);
    
    if (statusResult.hasSuggestion) {
      console.log("✅ API correctly reports suggestion is available");
    } else {
      console.log("❌ API reports no suggestion is available");
      throw new Error("Suggestion not found in cache");
    }
    
    // Step 3: Get the suggestion content
    console.log("\nSTEP 3: Retrieving suggestion content via API");
    
    const getResponse = await fetch(`http://localhost:5000/api/columns/${TEST_COLUMN_ID}/prompt-suggestion/${TEST_CARD_ID}`);
    if (!getResponse.ok) {
      throw new Error(`Failed to get suggestion: ${getResponse.status}`);
    }
    
    const response = await getResponse.json();
    console.log("Suggestion content:", response);
    
    if (response && response.suggestion) {
      console.log("✅ Successfully retrieved suggestion content");
    } else {
      console.log("❌ Retrieved suggestion doesn't match the original");
      throw new Error("Suggestion content mismatch");
    }
    
    // Step 4: Accept the suggestion (simulate user accepting it)
    console.log("\nSTEP 4: Accepting the suggestion via API");
    
    const acceptResponse = await fetch(`http://localhost:5000/api/columns/${TEST_COLUMN_ID}/prompt-suggestion/accept/${TEST_CARD_ID}`, {
      method: 'POST',
    });
    
    if (!acceptResponse.ok) {
      throw new Error(`Failed to accept suggestion: ${acceptResponse.status}`);
    }
    
    const acceptResult = await acceptResponse.json();
    console.log("Accept response:", acceptResult);
    console.log("✅ Suggestion accepted successfully");
    
    // Step 5: Verify the suggestion was cleared
    console.log("\nSTEP 5: Verifying suggestion was cleared after acceptance");
    
    const finalStatusResponse = await fetch(`http://localhost:5000/api/columns/${TEST_COLUMN_ID}/prompt-suggestion/check/${TEST_CARD_ID}`);
    const finalStatus = await finalStatusResponse.json();
    
    if (!finalStatus.hasSuggestion) {
      console.log("✅ Suggestion correctly cleared after acceptance");
    } else {
      console.log("❌ Suggestion still available after acceptance");
    }
    
    console.log("\n✅ Complete API workflow test successful!");
    
  } catch (error) {
    console.error("Error during API workflow test:", error);
    console.log("❌ API workflow test failed");
  }
  
  console.log("\n==================================================");
  console.log("TEST COMPLETE");
  console.log("==================================================\n");
}

// Run the test
testApiWorkflow();