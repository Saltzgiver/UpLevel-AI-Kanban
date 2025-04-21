/**
 * Script to fetch and display available MCP actions
 */

async function getMcpActions() {
  try {
    console.log('Fetching available MCP actions...');
    
    const url = 'http://localhost:5000/api/mcp/actions';
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch actions: ${response.status} ${response.statusText}`);
    }
    
    const actions = await response.json();
    
    console.log(`Found ${actions.length} MCP actions\n`);
    
    // Display available actions in detail
    console.log('Available MCP Actions:');
    console.log('=====================\n');
    
    actions.forEach((action, index) => {
      console.log(`${index + 1}. ${action.name}`);
      console.log(`   Description: ${action.description || 'No description'}`);
      console.log(`   ID: ${action.id}`);
      
      if (action.parameters && action.parameters.length > 0) {
        console.log('   Parameters:');
        action.parameters.forEach(param => {
          console.log(`     - ${param.name}: ${param.description || 'No description'} (${param.required ? 'Required' : 'Optional'})`);
        });
      }
      
      console.log(''); // Empty line for readability
    });
    
    return actions;
  } catch (error) {
    console.error(`Error fetching MCP actions: ${error.message}`);
    return [];
  }
}

// Run the function
getMcpActions();
