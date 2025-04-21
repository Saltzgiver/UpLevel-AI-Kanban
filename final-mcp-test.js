/**
 * Final test script for Google Docs MCP integration
 * This script tests the full flow, including our mcpClient.ts changes
 */

// Mock implementation of run-google-docs-test.js
async function makeRequest(endpoint, method = 'GET', body = undefined) {
  try {
    const url = `http://localhost:5000/api${endpoint}`;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    console.log(`Making ${method} request to ${url}`);
    const response = await fetch(url, options);
    
    const contentType = response.headers.get('content-type');
    let responseData;
    
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }
    
    if (!response.ok) {
      console.error(`HTTP error: ${response.status} ${response.statusText}`);
      console.error(`Response body: ${JSON.stringify(responseData, null, 2)}`);
      return { success: false, status: response.status, error: JSON.stringify(responseData) };
    }
    
    return responseData;
  } catch (error) {
    console.error(`Network error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// The main test function
async function testGoogleDocsMcpIntegration() {
  console.log('🔍 Testing Google Docs MCP integration with updated mcpClient.ts\n');
  
  try {
    // 1. Get MCP actions to find the Google Docs action
    console.log('1. Getting MCP actions...');
    const actions = await makeRequest('/mcp/actions');
    
    console.log(`Found ${actions.length} MCP actions`);
    const googleDocsAction = actions.find(a => a.name === 'google_docs.find_document');
    
    if (!googleDocsAction) {
      throw new Error('Google Docs action not found!');
    }
    
    console.log(`Found Google Docs action: ${googleDocsAction.name}`);
    
    // 2. Test the Google Docs MCP integration with a card
    console.log('\n2. Testing Google Docs search with card 94...');
    const cardId = 94; // Use an existing card
    
    const publishResult = await makeRequest(
      `/cards/${cardId}/mcp-publish`, 
      'POST', 
      {
        actionName: 'google_docs.find_document',
        params: { query: 'Project Doc' }
      }
    );
    
    if (publishResult.success) {
      console.log('✅ Success! Google Docs search completed');
      console.log('Result:', JSON.stringify(publishResult, null, 2));
    } else {
      console.log('⚠️ Google Docs search failed:', publishResult);
    }
    
    // 3. Get MCP logs to verify what happened
    console.log('\n3. Getting MCP logs...');
    const logs = await makeRequest('/mcp/logs');
    
    console.log(`Found ${logs.length} MCP logs`);
    
    if (logs.length > 0) {
      console.log('Latest log:', JSON.stringify(logs[0], null, 2));
    }
    
    console.log('\n✅ Test completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testGoogleDocsMcpIntegration();
