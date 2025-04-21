/**
 * Script to fetch and display details about the Google Docs MCP action
 */

async function getGoogleDocsAction() {
  try {
    console.log('Fetching details about Google Docs MCP action...');
    
    const url = 'http://localhost:5000/api/mcp/actions';
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch actions: ${response.status} ${response.statusText}`);
    }
    
    const actions = await response.json();
    const googleDocsAction = actions.find(action => action.name === 'google_docs.find_document');
    
    if (!googleDocsAction) {
      throw new Error('Google Docs find_document action not found');
    }
    
    console.log('Google Docs Action Details:');
    console.log('=========================\n');
    console.log(`Name: ${googleDocsAction.name}`);
    console.log(`ID: ${googleDocsAction.id}`);
    console.log(`Description: ${googleDocsAction.description || 'No description'}`);
    
    if (googleDocsAction.parameters && googleDocsAction.parameters.length > 0) {
      console.log('\nParameters:');
      googleDocsAction.parameters.forEach(param => {
        console.log(`  - ${param.name}: ${param.description || 'No description'}`);
        console.log(`    Required: ${param.required ? 'Yes' : 'No'}`);
        console.log(`    Type: ${param.type || 'Not specified'}`);
        if (param.default) console.log(`    Default: ${param.default}`);
        console.log('');
      });
    } else {
      console.log('\nNo parameters found for this action.');
    }
    
    return googleDocsAction;
  } catch (error) {
    console.error(`Error fetching Google Docs action: ${error.message}`);
    return null;
  }
}

// Run the function
getGoogleDocsAction();
