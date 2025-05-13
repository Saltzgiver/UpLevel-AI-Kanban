/**
 * Test script for card move triggering suggestion
 * 
 * This script will:
 * 1. Move a card from one GPT-enabled column to another
 * 2. Log the entire process to help diagnose issues with the suggestion system
 * 3. Monitor network activity and console logs
 */

import fetch from 'node-fetch';

// Configuration
const BASE_URL = 'http://localhost:5000';
const SOURCE_COLUMN_ID = 66; // Replace with an actual GPT-enabled column ID
const DESTINATION_COLUMN_ID = 67; // Replace with another GPT-enabled column ID
const CARD_ID = 100; // Replace with an actual card ID

async function makeRequest(endpoint, method = 'GET', body = undefined) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  
  // Check if response is HTML instead of JSON
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/html')) {
    console.error(`Response contains HTML instead of JSON. Endpoint: ${endpoint}`);
    return {
      status: response.status,
      data: { error: 'Received HTML instead of JSON' }
    };
  }
  
  try {
    const data = await response.json();
    return { 
      status: response.status,
      data 
    };
  } catch (error) {
    console.error(`Error parsing JSON from ${endpoint}:`, error);
    const text = await response.text();
    console.error(`Response text (first 100 chars): ${text.substring(0, 100)}...`);
    return {
      status: response.status,
      data: { error: 'Failed to parse JSON response' }
    };
  }
}

async function testCardMoveAndSuggestion() {
  console.log('===== TESTING CARD MOVE & SUGGESTION GENERATION =====');
  
  try {
    // Step 1: Get information about the source and destination columns to verify they have GPT assigned
    console.log(`\n1. Getting information about columns ${SOURCE_COLUMN_ID} and ${DESTINATION_COLUMN_ID}`);
    
    const sourceColumnResponse = await makeRequest(`/api/columns/${SOURCE_COLUMN_ID}`);
    const destColumnResponse = await makeRequest(`/api/columns/${DESTINATION_COLUMN_ID}`);
    
    if (sourceColumnResponse.status !== 200 || destColumnResponse.status !== 200) {
      console.error('Error: Could not retrieve column information');
      return;
    }
    
    const sourceColumn = sourceColumnResponse.data;
    const destColumn = destColumnResponse.data;
    
    console.log(`Source column: ${sourceColumn.name} (GPT assigned: ${sourceColumn.gptAssigned ? 'Yes' : 'No'})`);
    console.log(`Destination column: ${destColumn.name} (GPT assigned: ${destColumn.gptAssigned ? 'Yes' : 'No'})`);
    
    if (!sourceColumn.gptAssigned) {
      console.error(`Error: Source column ${SOURCE_COLUMN_ID} does not have GPT assigned. Suggestions won't be generated.`);
      return;
    }
    
    // Step 2: Get information about the card
    console.log(`\n2. Getting information about card ${CARD_ID}`);
    
    const cardResponse = await makeRequest(`/api/cards/${CARD_ID}`);
    
    if (cardResponse.status !== 200) {
      console.error(`Error: Could not retrieve card ${CARD_ID}`);
      return;
    }
    
    const card = cardResponse.data;
    console.log(`Card: ${card.title} (Currently in column: ${card.columnId})`);
    
    // Make sure the card is in the source column
    if (card.columnId !== SOURCE_COLUMN_ID) {
      console.error(`Error: Card ${CARD_ID} is not in source column ${SOURCE_COLUMN_ID}. It's in column ${card.columnId}.`);
      return;
    }
    
    // Step 3: Move the card
    console.log(`\n3. Moving card ${CARD_ID} from column ${SOURCE_COLUMN_ID} to ${DESTINATION_COLUMN_ID}`);
    
    const moveResponse = await makeRequest(
      `/api/cards/${CARD_ID}/move`,
      'PATCH',
      {
        sourceColumnId: SOURCE_COLUMN_ID,
        destinationColumnId: DESTINATION_COLUMN_ID,
        position: 0 // Move to top position
      }
    );
    
    if (moveResponse.status !== 200) {
      console.error(`Error moving card: ${JSON.stringify(moveResponse.data)}`);
      return;
    }
    
    console.log(`Card moved successfully: ${JSON.stringify(moveResponse.data)}`);
    
    // Step 4: Wait and check for suggestion
    console.log(`\n4. Waiting for suggestion generation (this might take a few seconds)...`);
    
    let hasFoundSuggestion = false;
    
    for (let attempt = 1; attempt <= 10; attempt++) {
      console.log(`\nChecking for suggestion (attempt ${attempt}/10)...`);
      
      // Wait 1 second between checks
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if suggestion exists
      const suggestionCheckResponse = await makeRequest(
        `/api/columns/${SOURCE_COLUMN_ID}/prompt-suggestion/status/${CARD_ID}`
      );
      
      console.log(`Suggestion check response: ${JSON.stringify(suggestionCheckResponse.data)}`);
      
      if (suggestionCheckResponse.data.hasSuggestion) {
        hasFoundSuggestion = true;
        console.log(`\n✅ Suggestion found for column ${SOURCE_COLUMN_ID} and card ${CARD_ID}!`);
        
        // Get the full suggestion
        const suggestionResponse = await makeRequest(
          `/api/columns/${SOURCE_COLUMN_ID}/prompt-suggestion/${CARD_ID}`
        );
        
        console.log(`\nSuggestion content:`);
        console.log(JSON.stringify(suggestionResponse.data, null, 2));
        
        break;
      }
    }
    
    if (!hasFoundSuggestion) {
      console.log(`\n❌ No suggestion was generated after moving the card.`);
      console.log(`Debugging tips:`);
      console.log(`1. Check server logs for any errors during suggestion generation`);
      console.log(`2. Make sure the card had chat messages in the source column`);
      console.log(`3. Verify that the OpenAI API key is valid and working`);
    }
    
    console.log('\n===== TEST COMPLETE =====');
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testCardMoveAndSuggestion();