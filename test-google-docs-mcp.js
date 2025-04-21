/**
 * Test script for Google Docs MCP integration
 * 
 * This script tests:
 * 1. Creating a column with MCP enabled
 * 2. Adding Google Docs action to the column
 * 3. Testing the Google Docs search functionality
 */

// Use node-fetch for making HTTP requests
const fetch = require('node-fetch');

// Base URL for API requests
const API_BASE = process.env.REPL_SLUG 
  ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/api`
  : 'http://localhost:3000/api';

// Helper function to make API requests
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
    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      data: data
    };
  } catch (error) {
    return {
      success: false,
      status: 'error',
      error: error.message
    };
  }
}

async function testGoogleDocsMcpIntegration() {
  console.log('🔍 Testing Google Docs MCP integration...');
  
  try {
    // 1. Get all boards to find or create a column for testing
    console.log('\n1. Getting boards...');
    const boardsResponse = await makeRequest('/boards');
    
    if (!boardsResponse.success) {
      throw new Error(`Failed to get boards: ${boardsResponse.status}`);
    }
    
    if (boardsResponse.data.length === 0) {
      throw new Error('No boards found!');
    }
    
    const board = boardsResponse.data[0];
    console.log(`Found board: ${board.name} (ID: ${board.id})`);
    
    // 2. Create a new column for Google Docs testing
    console.log('\n2. Creating Google Docs test column...');
    const createColumnResponse = await makeRequest(
      '/columns', 
      'POST', 
      {
        name: 'Google Docs MCP',
        boardId: board.id,
        mcpEnabled: true,
        mcpAutoTrigger: true
      }
    );
    
    if (!createColumnResponse.success) {
      throw new Error(`Failed to create column: ${createColumnResponse.status}`);
    }
    
    const column = createColumnResponse.data;
    console.log(`Created column: ${column.name} (ID: ${column.id})`);
    
    // 3. Get available MCP actions
    console.log('\n3. Getting MCP actions...');
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
    
    // 4. Add Google Docs action to the column
    console.log('\n4. Adding Google Docs action to column...');
    const addActionResponse = await makeRequest(
      `/columns/${column.id}/mcp-actions`, 
      'POST', 
      {
        actionName: googleDocsAction.name,
        enabled: true
      }
    );
    
    if (!addActionResponse.success) {
      throw new Error(`Failed to add action to column: ${addActionResponse.status}`);
    }
    
    console.log(`Google Docs action added to column!`);
    
    // 5. Create a test card in the column
    console.log('\n5. Creating test card...');
    const createCardResponse = await makeRequest(
      '/cards', 
      'POST', 
      {
        title: 'Find Project Plan Document',
        description: 'Use this card to find documents named "Project Plan" in Google Docs',
        columnId: column.id,
        order: 0
      }
    );
    
    if (!createCardResponse.success) {
      throw new Error(`Failed to create card: ${createCardResponse.status}`);
    }
    
    const card = createCardResponse.data;
    console.log(`Created test card: ${card.title} (ID: ${card.id})`);
    
    // 6. Create a test chat message to simulate asking for a document
    console.log('\n6. Creating test chat message...');
    const createChatResponse = await makeRequest(
      '/chats', 
      'POST', 
      {
        cardId: card.id,
        message: 'Please find the Google Doc named "Project Plan"',
        source: 'user'
      }
    );
    
    if (!createChatResponse.success) {
      throw new Error(`Failed to create chat message: ${createChatResponse.status}`);
    }
    
    console.log(`Created test chat message!`);
    
    // 7. Manually trigger Google Docs action for the card
    console.log('\n7. Manually triggering Google Docs search action...');
    const publishResponse = await makeRequest(
      `/cards/${card.id}/mcp-publish`, 
      'POST', 
      { 
        actionName: googleDocsAction.name,
        action_params: {
          query: 'Project Plan'
        }
      }
    );
    
    if (!publishResponse.success) {
      console.warn(`⚠️  Manual publish response: ${JSON.stringify(publishResponse)}`);
    } else {
      console.log(`✅ Google Docs search triggered successfully!`);
      console.log(`Response: ${JSON.stringify(publishResponse.data)}`);
    }
    
    // 8. Get MCP logs to verify the action
    console.log('\n8. Getting MCP logs...');
    const logsResponse = await makeRequest('/mcp/logs');
    
    if (!logsResponse.success) {
      throw new Error(`Failed to get MCP logs: ${logsResponse.status}`);
    }
    
    console.log(`Found ${logsResponse.data.length} MCP log entries`);
    
    if (logsResponse.data.length > 0) {
      const latest = logsResponse.data[0];
      console.log(`Latest log entry: ${JSON.stringify(latest)}`);
    }
    
    console.log('\n✅ Google Docs MCP integration test completed successfully!');
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
  }
}

// Run the test
testGoogleDocsMcpIntegration();