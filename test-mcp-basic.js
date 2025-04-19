/**
 * Basic test script for Zapier MCP integration
 * 
 * This script tests:
 * 1. Enabling MCP on a column
 * 2. Adding an MCP action to that column
 * 3. Testing the MCP webhooks using the ping action
 */

// URL for API requests
// Use the Replit URL instead of localhost
const API_URL = 'https://cfd09c47-033e-4560-be8b-14616a02637f-00-3lzr12l6l41pj.picard.replit.dev/api';

// Helper function for making API requests
async function makeRequest(endpoint, method = 'GET', body = undefined) {
  try {
    const url = `${API_URL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    return { 
      success: response.ok, 
      status: response.status, 
      data 
    };
  } catch (error) {
    console.error(`Request error for ${endpoint}:`, error);
    return { success: false, error: error.message };
  }
}

async function testMcpBasic() {
  console.log('🔍 Testing basic MCP functionality...');
  
  try {
    // 1. Get all boards to find a column we can use
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
    
    if (board.columns.length === 0) {
      throw new Error('No columns found in the board!');
    }
    
    // Use the second column (assuming there's at least 2 columns)
    const columnIndex = board.columns.length > 1 ? 1 : 0;
    const column = board.columns[columnIndex];
    console.log(`Using column: ${column.name} (ID: ${column.id})`);
    
    // 2. Enable MCP on the column
    console.log('\n2. Enabling MCP on column...');
    const enableResponse = await makeRequest(
      `/columns/${column.id}/mcp-settings`, 
      'PATCH', 
      { mcpEnabled: true }
    );
    
    if (!enableResponse.success) {
      throw new Error(`Failed to enable MCP on column: ${enableResponse.status}`);
    }
    
    console.log(`MCP enabled on column ${column.name}`);
    
    // 3. Get available MCP actions
    console.log('\n3. Getting MCP actions...');
    const actionsResponse = await makeRequest('/mcp/actions');
    
    if (!actionsResponse.success) {
      throw new Error(`Failed to get MCP actions: ${actionsResponse.status}`);
    }
    
    if (actionsResponse.data.length === 0) {
      throw new Error('No MCP actions found!');
    }
    
    // Find the ping action for testing
    const pingAction = actionsResponse.data.find(a => a.name === 'ping');
    
    if (!pingAction) {
      throw new Error('Ping action not found! Run generate_mcp_actions.js first.');
    }
    
    console.log(`Found ping action: ${pingAction.name} (${pingAction.displayName})`);
    
    // 4. Add the ping action to the column
    console.log('\n4. Adding ping action to column...');
    const addActionResponse = await makeRequest(
      `/columns/${column.id}/mcp-actions`, 
      'POST', 
      { actionName: pingAction.name }
    );
    
    if (!addActionResponse.success) {
      throw new Error(`Failed to add MCP action to column: ${addActionResponse.status}`);
    }
    
    console.log(`Added ${pingAction.name} action to column ${column.name}`);
    
    // 5. Create a test card
    console.log('\n5. Creating test card...');
    const testCard = {
      title: 'MCP Test Card',
      description: 'This is a test card for MCP integration',
      columnId: column.id
    };
    
    const createCardResponse = await makeRequest('/cards', 'POST', testCard);
    
    if (!createCardResponse.success) {
      throw new Error(`Failed to create test card: ${createCardResponse.status}`);
    }
    
    const card = createCardResponse.data;
    console.log(`Created test card: ${card.title} (ID: ${card.id})`);
    
    // 6. Manually trigger MCP action for the card
    console.log('\n6. Manually triggering MCP action...');
    const publishResponse = await makeRequest(
      `/cards/${card.id}/mcp-publish`, 
      'POST', 
      { actionName: pingAction.name }
    );
    
    if (!publishResponse.success) {
      console.warn(`⚠️  Manual publish response: ${JSON.stringify(publishResponse)}`);
    } else {
      console.log(`✅ MCP action triggered successfully!`);
      console.log(`Response: ${JSON.stringify(publishResponse.data)}`);
    }
    
    // 7. Get MCP logs to verify the action was triggered
    console.log('\n7. Getting MCP logs...');
    const logsResponse = await makeRequest('/mcp/logs');
    
    if (!logsResponse.success) {
      throw new Error(`Failed to get MCP logs: ${logsResponse.status}`);
    }
    
    console.log(`Found ${logsResponse.data.length} MCP log entries`);
    
    if (logsResponse.data.length > 0) {
      const latestLog = logsResponse.data[0];
      console.log(`Latest log: ${JSON.stringify(latestLog)}`);
    }
    
    console.log('\n✅ MCP integration test completed successfully!');
  } catch (error) {
    console.error(`❌ MCP test failed: ${error.message}`);
  }
}

// Run the test
testMcpBasic();