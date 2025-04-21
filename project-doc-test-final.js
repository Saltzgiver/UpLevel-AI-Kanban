/**
 * Final test for Google Docs Project Doc search
 */

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

async function testProjectDocSearch() {
  console.log('🔍 Testing Google Docs search for "Project Doc"\n');
  
  try {
    // 1. Ensure Google Docs action exists
    console.log('1. Getting MCP actions...');
    const actions = await makeRequest('/mcp/actions');
    
    console.log(`Found ${actions.length} MCP actions`);
    const googleDocsAction = actions.find(a => a.name === 'google_docs.find_document');
    
    if (!googleDocsAction) {
      throw new Error('Google Docs action not found!');
    }
    
    console.log(`Found Google Docs action: ${googleDocsAction.name}`);
    
    // 2. Search for Project Doc
    console.log('\n2. Searching for "Project Doc"...');
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
      
      if (publishResult.external_id) {
        console.log(`Document ID: ${publishResult.external_id}`);
      }
      
      if (publishResult.external_url) {
        console.log(`Document URL: ${publishResult.external_url}`);
      }
      
      if (publishResult.document) {
        console.log('\nDocument details:');
        console.log(JSON.stringify(publishResult.document, null, 2));
      }
    } else {
      console.log('⚠️ Google Docs search failed:', publishResult);
    }
    
    // 3. Get latest MCP log
    console.log('\n3. Getting latest MCP log...');
    const logs = await makeRequest('/mcp/logs');
    
    if (logs && logs.length > 0) {
      const latestLog = logs[0];
      console.log(`Latest log ID: ${latestLog.id}`);
      console.log(`Status code: ${latestLog.statusCode}`);
      
      if (latestLog.responseBody) {
        try {
          const responseBody = JSON.parse(latestLog.responseBody);
          console.log('\nResponse body:');
          console.log(JSON.stringify(responseBody, null, 2));
          
          if (responseBody.document) {
            console.log('\nFound document:');
            console.log(`Name: ${responseBody.document.name}`);
            console.log(`URL: ${responseBody.document.url}`);
            if (responseBody.document.content) {
              console.log('\nDocument content:');
              console.log('------------------');
              console.log(responseBody.document.content);
              console.log('------------------');
            } else {
              console.log('\nNo content in the document response');
            }
          }
        } catch (e) {
          console.log('Response body (raw):', latestLog.responseBody);
        }
      }
    } else {
      console.log('No MCP logs found');
    }
    
    console.log('\n✅ Test completed!');
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
  }
}

// Run the test
testProjectDocSearch();
