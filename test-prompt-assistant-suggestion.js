/**
 * Test script for the Prompt Assistant Suggestion features
 * 
 * This script tests the creation of test suggestions and validation of
 * the toast notification system. It uses real column and card IDs.
 */

async function testPromptAssistantSuggestion() {
  console.log("=== Testing Prompt Assistant Suggestion Flow ===");
  
  try {
    // Real column and card IDs from the database
    const columnId = 9; // "image test" column (has gptAssigned = true)
    const cardId = 47;  // "Image Generation Test" card
    
    // Create a test suggestion with our API
    console.log(`Creating test suggestion for column ${columnId} and card ${cardId}...`);
    const testSuggestion = {
      rationale: "Based on recent image generation results, we noticed that adding more specific details about the desired style and composition yields better results.",
      suggestedInstructions: "Generate a detailed image based on the card title and description. Include specific style guidance (photorealistic, cartoon, watercolor, etc.) and composition details (close-up, landscape, portrait, etc.) in your response."
    };
    
    const createResponse = await fetch(`http://localhost:3000/api/columns/${columnId}/prompt-suggestion/create-test/${cardId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ suggestion: testSuggestion }),
    });
    
    const createResult = await createResponse.json();
    console.log("Create suggestion response:", createResult);
    
    if (createResponse.ok) {
      console.log("✅ Test suggestion created successfully");
      
      // Check the suggestion status
      console.log(`Checking suggestion status for column ${columnId} and card ${cardId}...`);
      const statusResponse = await fetch(`http://localhost:3000/api/columns/${columnId}/prompt-suggestion/status/${cardId}`);
      const statusResult = await statusResponse.json();
      console.log("Status response:", statusResult);
      
      if (statusResponse.ok && statusResult.hasSuggestion) {
        console.log("✅ Suggestion status check successful - suggestion is available");
        
        // Get the suggestion content
        console.log(`Getting suggestion content for column ${columnId} and card ${cardId}...`);
        const getSuggestionResponse = await fetch(`http://localhost:3000/api/columns/${columnId}/prompt-suggestion/${cardId}`);
        const getSuggestionResult = await getSuggestionResponse.json();
        console.log("Suggestion content:", getSuggestionResult);
        
        if (getSuggestionResponse.ok && getSuggestionResult.suggestion) {
          console.log("✅ Suggestion content retrieved successfully");
          console.log("=== MANUAL TESTING STEPS ===");
          console.log("1. Go to the Kanban board in the app");
          console.log("2. You should see a toast notification about a suggestion for column 'image test'");
          console.log("3. Click 'View' on the toast to open the suggestion modal");
          console.log("4. Verify that the suggestion appears correctly in the modal");
          console.log("5. Test accepting and rejecting the suggestion");
        } else {
          console.log("❌ Failed to retrieve suggestion content");
        }
      } else {
        console.log("❌ Suggestion status check failed");
      }
    } else {
      console.log("❌ Failed to create test suggestion");
    }
  } catch (error) {
    console.error("Error during test:", error);
  }
}

// Run the test
testPromptAssistantSuggestion();