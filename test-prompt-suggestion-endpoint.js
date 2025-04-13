/**
 * Test script for the new prompt suggestion endpoint
 * This script tests the manual triggering of suggestions via the API
 */

import fetch from 'node-fetch';

async function testPromptSuggestionEndpoint() {
  console.log('=== Testing Prompt Suggestion Endpoint ===');
  
  try {
    // Use any valid card and column ID from your database
    const columnId = 5; // Replace with a valid column ID
    const cardId = 10;  // Replace with a valid card ID that has chat history
    
    console.log(`Testing with column ID ${columnId} and card ID ${cardId}`);
    
    // 1. Call the POST endpoint to generate a suggestion
    console.log('\n1. Requesting prompt suggestion...');
    const suggestionResponse = await fetch(`http://localhost:3000/api/columns/${columnId}/prompt-suggestion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cardId })
    });
    
    if (!suggestionResponse.ok) {
      throw new Error(`Failed to get suggestion: ${suggestionResponse.status} ${suggestionResponse.statusText}`);
    }
    
    const suggestion = await suggestionResponse.json();
    console.log('Suggestion response:', JSON.stringify(suggestion, null, 2));
    
    if (suggestion.suggestion) {
      console.log('\nSuggestion received:');
      if (suggestion.suggestion.rationale) {
        console.log(`Rationale: ${suggestion.suggestion.rationale}`);
        console.log(`Suggested Instructions: ${suggestion.suggestion.suggestedInstructions}`);
      } else {
        console.log(suggestion.suggestion);
      }
    } else {
      console.log('No suggestion generated.');
    }
    
    // 2. Check the status endpoint
    console.log('\n2. Checking suggestion status...');
    const statusResponse = await fetch(`http://localhost:3000/api/columns/${columnId}/prompt-suggestion/status`);
    const statusData = await statusResponse.json();
    console.log('Status:', statusData);
    
    // 3. Get the actual suggestion content
    console.log('\n3. Retrieving suggestion content...');
    const contentResponse = await fetch(`http://localhost:3000/api/columns/${columnId}/prompt-suggestion`);
    
    if (contentResponse.ok) {
      const contentData = await contentResponse.json();
      console.log('Suggestion content:', contentData);
      
      // 4. Optional: Accept the suggestion
      if (statusData.hasSuggestion) {
        console.log('\n4. Accepting suggestion...');
        const acceptResponse = await fetch(`http://localhost:3000/api/columns/${columnId}/prompt-suggestion/accept`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (acceptResponse.ok) {
          const acceptData = await acceptResponse.json();
          console.log('Suggestion accepted:', acceptData);
        } else {
          console.log('Failed to accept suggestion:', acceptResponse.status, acceptResponse.statusText);
        }
      }
    } else {
      console.log('No suggestion content available:', contentResponse.status, contentResponse.statusText);
    }
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testPromptSuggestionEndpoint();