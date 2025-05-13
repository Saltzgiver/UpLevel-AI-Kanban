/**
 * Test script to verify the suggestion status endpoint
 *
 * This script will:
 * 1. Create a test suggestion for a specific column and card
 * 2. Check if the /status/ endpoint correctly reports the suggestion
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';
const COLUMN_ID = 66; // Replace with an actual GPT-enabled column ID
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

  console.log(`Making ${method} request to ${endpoint}`);
  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  
  // Log response headers
  console.log('Response status:', response.status);
  console.log('Response headers:', Object.fromEntries([...response.headers]));
  
  try {
    const text = await response.text();
    console.log(`Response text (first 200 chars): ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
    
    try {
      // Try to parse as JSON
      return { 
        status: response.status,
        data: JSON.parse(text) 
      };
    } catch (jsonError) {
      console.error('Error parsing JSON:', jsonError);
      return {
        status: response.status,
        text
      };
    }
  } catch (error) {
    console.error('Error reading response:', error);
    return {
      status: response.status,
      error: error.message
    };
  }
}

async function createTestSuggestion() {
  console.log(`Creating test suggestion for column ${COLUMN_ID}, card ${CARD_ID}`);
  
  const testSuggestion = {
    suggestion: {
      rationale: "This is a test rationale for prompt improvement",
      suggestedInstructions: "As an AI assistant, your task is to:\n\n1. Analyze requests\n2. Provide structured responses\n3. Include examples\n4. Be helpful and conversational"
    }
  };
  
  return makeRequest(
    `/api/columns/${COLUMN_ID}/prompt-suggestion/create-test/${CARD_ID}`,
    'POST',
    testSuggestion
  );
}

async function checkSuggestionWithStatusEndpoint() {
  console.log(`Checking suggestion with /status/ endpoint: column ${COLUMN_ID}, card ${CARD_ID}`);
  return makeRequest(`/api/columns/${COLUMN_ID}/prompt-suggestion/status/${CARD_ID}`);
}

async function checkSuggestionWithCheckEndpoint() {
  console.log(`Checking suggestion with /check/ endpoint: column ${COLUMN_ID}, card ${CARD_ID}`);
  return makeRequest(`/api/columns/${COLUMN_ID}/prompt-suggestion/check/${CARD_ID}`);
}

async function runTest() {
  console.log('===== TESTING SUGGESTION STATUS ENDPOINT =====\n');
  
  try {
    // Step 1: Create a test suggestion
    console.log('STEP 1: Creating test suggestion');
    const createResult = await createTestSuggestion();
    console.log('Create result:', JSON.stringify(createResult, null, 2));
    console.log('\n');
    
    // Step 2: Check suggestion with /status/ endpoint
    console.log('STEP 2: Checking with /status/ endpoint');
    const statusResult = await checkSuggestionWithStatusEndpoint();
    console.log('Status result:', JSON.stringify(statusResult, null, 2));
    console.log('\n');
    
    // Step 3: Compare with /check/ endpoint
    console.log('STEP 3: Checking with /check/ endpoint');
    const checkResult = await checkSuggestionWithCheckEndpoint();
    console.log('Check result:', JSON.stringify(checkResult, null, 2));
    console.log('\n');
    
    // Analysis
    console.log('ANALYSIS:');
    if (statusResult.data && statusResult.data.hasSuggestion === true) {
      console.log('✅ /status/ endpoint CORRECTLY reports hasSuggestion = true');
    } else {
      console.log('❌ /status/ endpoint INCORRECTLY reports hasSuggestion = false or undefined');
      console.log('This could be why suggestions are not showing in the frontend!');
    }
    
    if (checkResult.data && checkResult.data.hasSuggestion === true) {
      console.log('✅ /check/ endpoint CORRECTLY reports hasSuggestion = true');
    } else {
      console.log('❌ /check/ endpoint INCORRECTLY reports hasSuggestion = false or undefined');
    }
    
    console.log('\n===== TEST COMPLETE =====');
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
runTest();