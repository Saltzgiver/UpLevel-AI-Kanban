/**
 * Test runner for Google Docs MCP Integration
 * 
 * This script executes an API request directly to test the Google Docs MCP action
 * without relying on importing TypeScript modules.
 */

import fetch from 'node-fetch';

// Base URL for API requests
const API_BASE = 'https://cfd09c47-033e-4560-be8b-14616a02637f-00-3lzr12l6l41pj.picard.replit.dev/api';

async function makeRequest(endpoint, method = 'GET', body = undefined) {
  const url = `${API_BASE}${endpoint}`;
  console.log(`Making ${method} request to ${url}`);

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP error: ${response.status} ${response.statusText}`);
      console.error(`Response body: ${errorText}`);
      return {
        success: false,
        status: response.status,
        error: errorText
      };
    }
    
    const data = await response.json();
    return {
      success: true,
      status: response.status,
      data: data
    };
  } catch (error) {
    console.error(`Request error: ${error.message}`);
    return {
      success: false,
      status: 'error',
      error: error.message
    };
  }
}

async function testGoogleDocsDirectly() {
  console.log("🔍 Testing Google Docs MCP integration directly...");
  
  try {
    // 1. First, check if we can get available MCP actions
    console.log("\n1. Getting MCP actions...");
    const actionsResponse = await makeRequest('/mcp/actions');
    
    if (!actionsResponse.success) {
      throw new Error(`Failed to get MCP actions: ${actionsResponse.status}`);
    }
    
    console.log(`Found ${actionsResponse.data.length} MCP actions`);
    
    // Find the Google Docs action
    const googleDocsAction = actionsResponse.data.find(a => a.name === 'google_docs.find_document');
    
    if (!googleDocsAction) {
      throw new Error('Google Docs action not found! Please run google-docs-mcp-action.js first');
    }
    
    console.log(`Found Google Docs action: ${googleDocsAction.name}`);
    
    // 2. Now, make a direct request to search for a document
    console.log("\n2. Testing Google Docs search directly...");
    
    // Use a fixed card ID (94) that we know exists
    const cardId = 94;
    console.log(`Using test card with ID: ${cardId}`);
    
    // Make the manual MCP publish request with the Google Docs action
    const publishResponse = await makeRequest(
      `/cards/${cardId}/mcp-publish`, 
      'POST', 
      { 
        actionName: googleDocsAction.name,
        action_params: {
          query: 'Project Doc'
        }
      }
    );
    
    if (!publishResponse.success) {
      console.warn(`⚠️  Google Docs search failed: ${JSON.stringify(publishResponse)}`);
    } else {
      console.log(`✅ Google Docs search response: ${JSON.stringify(publishResponse.data)}`);
    }
    
    // 3. Check the logs
    console.log("\n3. Getting MCP logs...");
    const logsResponse = await makeRequest('/mcp/logs');
    
    if (!logsResponse.success) {
      throw new Error(`Failed to get logs: ${logsResponse.status}`);
    }
    
    console.log(`Found ${logsResponse.data.length} MCP logs`);
    
    if (logsResponse.data.length > 0) {
      const latestLog = logsResponse.data[0];
      console.log(`Latest log: ${JSON.stringify(latestLog)}`);
    }
    
    console.log("\n✅ Test completed!");
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
  }
}

// Run the test
testGoogleDocsDirectly();
