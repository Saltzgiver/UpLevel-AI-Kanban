/**
 * Simplified direct test for MCP integration
 * Tests the MCP client by making direct requests to an MCP endpoint
 */

// Ensure the MCP endpoint is set
const endpoint = process.env.ZAPIER_MCP_ENDPOINT;
if (!endpoint) { console.error('ZAPIER_MCP_ENDPOINT environment variable is not set'); process.exit(1); }

// Simple function to make a request
async function testEndpoint() {
  console.log('🔍 Testing MCP endpoint directly with GET request');
  console.log(`Endpoint: ${endpoint}`);
  
  try {
    // Build query parameters 
    const queryParams = new URLSearchParams();
    queryParams.append('action', 'google_docs.find_document');
    queryParams.append('query', 'Project Doc');
    
    // Create full URL
    const url = `${endpoint}?${queryParams.toString()}`;
    console.log(`Request URL: ${url}`);
    
    // Make GET request
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('Success! Response data:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log(`Error response: ${text}`);
    }
  } catch (error) {
    console.error(`Request failed: ${error.message}`);
  }
}

// Run the test
testEndpoint();
