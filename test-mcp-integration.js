/**
 * Test script for Zapier MCP integration
 * 
 * This script tests:
 * 1. Creating a column with MCP enabled
 * 2. Creating a card in that column
 * 3. Testing the MCP integration
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api';

async function makeRequest(endpoint, method, body = undefined) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  
  return await response.json();
}

async function testMcpIntegration() {
  try {
    console.log('Testing Zapier MCP integration...');
    
    // 1. Test the MCP ping endpoint to check connection
    console.log('\n1. Testing MCP connection...');
    try {
      const pingResult = await makeRequest('/mcp/ping', 'GET');
      console.log('MCP connection result:', pingResult);
    } catch (error) {
      console.log('MCP connection test failed, but continuing with other tests:', error.message);
    }
    
    // 2. Get the first board
    console.log('\n2. Getting first board...');
    const boards = await makeRequest('/boards', 'GET');
    
    if (!boards.length) {
      throw new Error('No boards found. Please create a board first.');
    }
    
    const boardId = boards[0].id;
    console.log(`Using board: ${boards[0].name} (ID: ${boardId})`);
    
    // 3. Create a new column with MCP enabled
    console.log('\n3. Creating new MCP-enabled column...');
    const newColumn = await makeRequest('/columns', 'POST', {
      name: 'MCP Test Column',
      boardId,
      mcpEnabled: true,
      mcpAutoTrigger: true
    });
    
    console.log(`Created column: ${newColumn.name} (ID: ${newColumn.id})`);
    
    // 4. Update MCP settings via the dedicated endpoint
    console.log('\n4. Updating column MCP settings...');
    const mcpSettings = await makeRequest(`/columns/${newColumn.id}/mcp-settings`, 'PATCH', {
      mcpEnabled: true,
      mcpAutoTrigger: true
    });
    
    console.log('MCP settings updated:', mcpSettings);
    
    // 5. Get available MCP actions
    console.log('\n5. Fetching available MCP actions...');
    const actions = await makeRequest('/mcp/actions', 'GET');
    
    if (actions.length === 0) {
      console.log('No MCP actions found. You may need to create some first.');
    } else {
      console.log(`Found ${actions.length} MCP actions:`);
      actions.forEach(action => {
        console.log(`- ${action.name}: ${action.displayName}`);
      });
    }
    
    // 6. Create a new card in the column
    console.log('\n6. Creating a test card...');
    const newCard = await makeRequest('/cards', 'POST', {
      title: 'MCP Test Card',
      description: 'This is a test card for MCP integration',
      columnId: newColumn.id,
      order: 0
    });
    
    console.log(`Created card: ${newCard.title} (ID: ${newCard.id})`);
    
    // 7. Manually trigger an MCP action for the card (if actions are available)
    if (actions.length > 0) {
      console.log('\n7. Manually triggering MCP publish for the card...');
      try {
        const publishResult = await makeRequest(`/cards/${newCard.id}/mcp-publish`, 'POST', {
          actionName: actions[0].name
        });
        
        console.log('Publish result:', publishResult);
      } catch (error) {
        console.log('Manual publish failed:', error.message);
      }
    } else {
      console.log('\n7. Skipping manual MCP publish as no actions are available');
    }
    
    // 8. Get recent MCP logs
    console.log('\n8. Fetching recent MCP logs...');
    const logs = await makeRequest('/mcp/logs', 'GET');
    
    console.log(`Found ${logs.length} MCP logs`);
    logs.slice(0, 3).forEach(log => {
      console.log(`- ${log.direction} ${log.endpoint} (${log.statusCode}): ${log.error || 'Success'}`);
    });
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testMcpIntegration();