/**
 * End-to-end test for the prompt suggestion system
 * 
 * This script will:
 * 1. Create a test suggestion for a specific column and card
 * 2. Check if the suggestion is available
 * 3. Retrieve the suggestion content
 * 4. Simulate accepting the suggestion
 */

import fetch from 'node-fetch';

async function makeRequest(endpoint, method = 'GET', body = undefined) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`http://localhost:5000${endpoint}`, options);
  return response.json();
}

async function testSuggestionSystem() {
  try {
    console.log('====== TESTING PROMPT SUGGESTION SYSTEM ======');
    
    // Choose a column and card ID for testing (use existing IDs)
    const columnId = 66; // Replace with a real column ID from your system
    const cardId = 100;  // Replace with a real card ID from your system
    
    console.log(`Using Column ID: ${columnId}, Card ID: ${cardId} for test`);
    
    // Step 1: Create a test suggestion
    console.log('\n== 1. Creating test suggestion');
    const testSuggestion = {
      suggestion: {
        rationale: "This is a test rationale for prompt improvement",
        suggestedInstructions: "As an AI assistant, your task is to:\n\n1. Analyze requests\n2. Provide structured responses\n3. Include examples\n4. Be helpful and conversational"
      }
    };
    
    const createResult = await makeRequest(
      `/api/columns/${columnId}/prompt-suggestion/create-test/${cardId}`,
      'POST',
      testSuggestion
    );
    
    console.log(`Test suggestion created: ${JSON.stringify(createResult, null, 2)}`);
    
    // Step 2: Check if suggestion is available
    console.log('\n== 2. Checking if suggestion is available');
    const checkResult = await makeRequest(
      `/api/columns/${columnId}/prompt-suggestion/check/${cardId}`
    );
    
    console.log(`Suggestion availability: ${JSON.stringify(checkResult, null, 2)}`);
    
    if (!checkResult.hasSuggestion) {
      throw new Error('Suggestion was not found in cache after creation!');
    }
    
    // Step 3: Retrieve the suggestion content
    console.log('\n== 3. Retrieving suggestion content');
    const retrieveResult = await makeRequest(
      `/api/columns/${columnId}/prompt-suggestion/${cardId}`
    );
    
    console.log(`Retrieved suggestion content: ${JSON.stringify(retrieveResult, null, 2)}`);
    
    // Step 4: Accept the suggestion
    console.log('\n== 4. Accepting the suggestion');
    const acceptResult = await makeRequest(
      `/api/columns/${columnId}/prompt-suggestion/accept/${cardId}`,
      'POST'
    );
    
    console.log(`Suggestion acceptance result: ${JSON.stringify(acceptResult, null, 2)}`);
    
    // Step 5: Verify suggestion is gone after acceptance
    console.log('\n== 5. Verifying suggestion is gone after acceptance');
    const checkAfterAccept = await makeRequest(
      `/api/columns/${columnId}/prompt-suggestion/check/${cardId}`
    );
    
    console.log(`Suggestion availability after accept: ${JSON.stringify(checkAfterAccept, null, 2)}`);
    
    if (checkAfterAccept.hasSuggestion) {
      console.log('WARNING: Suggestion is still found in cache after acceptance!');
    } else {
      console.log('SUCCESS: Suggestion properly cleared from cache after acceptance');
    }
    
    console.log('\n====== TEST COMPLETE ======');
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
testSuggestionSystem();