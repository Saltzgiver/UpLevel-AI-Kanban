/**
 * Complete test for the Prompt Assistant workflow
 * 
 * This script tests the entire flow of the Prompt Assistant feature:
 * 1. Simulating a card move from a GPT-enabled column
 * 2. Generating a real suggestion using OpenAI
 * 3. Storing the suggestion in the cache
 * 4. Retrieving and displaying the suggestion
 */

const fetch = require('node-fetch');
const { storeSuggestion, checkSuggestion, clearSuggestion, dumpCache } = require('./server/suggestionCache.js');

// Test column and card data
const TEST_COLUMN_ID = 9;  // "image test" column
const TEST_CARD_ID = 47;   // "Image Generation Test" card

async function testFullPromptAssistantWorkflow() {
  console.log("\n==================================================");
  console.log("FULL PROMPT ASSISTANT WORKFLOW TEST");
  console.log("==================================================\n");
  
  try {
    // Step 1: Clear any existing suggestions for our test data
    console.log("STEP 1: Clearing existing suggestions for our test column/card");
    clearSuggestion(TEST_COLUMN_ID, TEST_CARD_ID);
    console.log("✅ Cache cleared");
    
    // Show cache state for verification
    console.log("\nCurrent cache state:");
    dumpCache();
    
    // Step 2: Fetch column data to get the instructions
    console.log("\nSTEP 2: Fetching column and card data");
    
    // Get column data to retrieve instructions
    const columnResponse = await fetch(`http://localhost:5000/api/columns/${TEST_COLUMN_ID}`);
    if (!columnResponse.ok) {
      throw new Error(`Failed to fetch column data: ${columnResponse.status}`);
    }
    const column = await columnResponse.json();
    console.log(`Retrieved column: ${column.name} with instructions: "${column.gptInstructions}"`);
    
    // Get card data
    const cardResponse = await fetch(`http://localhost:5000/api/cards/${TEST_CARD_ID}`);
    if (!cardResponse.ok) {
      throw new Error(`Failed to fetch card data: ${cardResponse.status}`);
    }
    const card = await cardResponse.json();
    console.log(`Retrieved card: ${card.title} - ${card.description}`);
    
    // Get chat history
    const chatsResponse = await fetch(`http://localhost:5000/api/cards/${TEST_CARD_ID}/chats`);
    if (!chatsResponse.ok) {
      throw new Error(`Failed to fetch chats: ${chatsResponse.status}`);
    }
    const chats = await chatsResponse.json();
    console.log(`Retrieved ${chats.length} chat messages for this card`);
    
    // Step 3: Generate a real suggestion with OpenAI
    console.log("\nSTEP 3: Generating a prompt suggestion with OpenAI");
    
    const suggestionResponse = await fetch("http://localhost:5000/api/test-prompt-suggestion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sourceColumnInstructions: column.gptInstructions || "Generate an image based on the card content",
        cardTitle: card.title,
        cardDescription: card.description,
        chats: chats,
        apiKey: "from_env"  // Use the environment API key
      })
    });
    
    if (!suggestionResponse.ok) {
      throw new Error(`Failed to generate suggestion: ${suggestionResponse.status}`);
    }
    
    const suggestionResult = await suggestionResponse.json();
    
    if (!suggestionResult.result) {
      console.log("No suggestion generated. This could be because OpenAI determined no improvements were needed.");
      return;
    }
    
    const suggestion = suggestionResult.result;
    console.log("\nSuggestion generated:");
    console.log(`Rationale: ${suggestion.rationale}`);
    console.log(`Suggested Instructions: ${suggestion.suggestedInstructions}`);
    
    // Step 4: Store the suggestion in the cache
    console.log("\nSTEP 4: Storing suggestion in the cache");
    storeSuggestion(TEST_COLUMN_ID, TEST_CARD_ID, suggestion);
    console.log("✅ Suggestion stored in cache");
    
    // Show cache state for verification
    console.log("\nUpdated cache state:");
    dumpCache();
    
    // Step 5: Verify suggestion can be retrieved
    console.log("\nSTEP 5: Verifying suggestion retrieval");
    const cachedSuggestion = checkSuggestion(TEST_COLUMN_ID, TEST_CARD_ID);
    
    if (cachedSuggestion && cachedSuggestion.hasSuggestion) {
      console.log("✅ Successfully retrieved suggestion from cache");
      console.log(`Cache has suggestion: ${cachedSuggestion.hasSuggestion}`);
      
      if (cachedSuggestion.suggestion) {
        const retrievedSuggestion = cachedSuggestion.suggestion;
        console.log(`Retrieved suggestion rationale: ${typeof retrievedSuggestion === 'object' ? retrievedSuggestion.rationale : 'Not available'}`);
      }
    } else {
      console.log("❌ Failed to retrieve suggestion from cache");
    }
    
    // Step 6: Test the API endpoint for checking suggestion status
    console.log("\nSTEP 6: Testing suggestion status API endpoint");
    
    const statusResponse = await fetch(`http://localhost:5000/api/columns/${TEST_COLUMN_ID}/prompt-suggestion/status/${TEST_CARD_ID}`);
    if (!statusResponse.ok) {
      throw new Error(`Failed to check suggestion status: ${statusResponse.status}`);
    }
    
    const statusResult = await statusResponse.json();
    console.log("API Status response:", statusResult);
    
    if (statusResult.hasSuggestion) {
      console.log("✅ API correctly reports suggestion is available");
    } else {
      console.log("❌ API reports no suggestion is available");
    }
    
    console.log("\n✅ Complete workflow test successful!");
    
  } catch (error) {
    console.error("Error during workflow test:", error);
    console.log("❌ Workflow test failed");
  }
  
  console.log("\n==================================================");
  console.log("TEST COMPLETE");
  console.log("==================================================\n");
}

// Run the test
testFullPromptAssistantWorkflow();