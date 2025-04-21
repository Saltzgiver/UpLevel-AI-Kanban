/**
 * Specific test for retrieving "Project Doc" via Google Docs MCP integration
 */

const endpoint = process.env.ZAPIER_MCP_ENDPOINT || 'https://actions.zapier.com/mcp/REDACTED/sse';

async function searchGoogleDoc(query) {
  console.log(`🔍 Searching for Google Doc with query: "${query}"`);
  
  try {
    // Build query parameters 
    const queryParams = new URLSearchParams();
    queryParams.append('action', 'google_docs.find_document');
    queryParams.append('query', query);
    
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
      console.log('✅ Success! Found document:');
      
      // Extract and display document content
      if (data && data.document) {
        console.log(`Document Name: ${data.document.name}`);
        console.log(`Document URL: ${data.document.url}`);
        console.log(`Owner: ${data.document.owner}`);
        console.log(`Last Modified: ${data.document.lastModified}`);
        
        if (data.document.content) {
          console.log('\nDocument Content:');
          console.log('-----------------');
          console.log(data.document.content);
          console.log('-----------------');
        } else {
          console.log('\nNo content available in the response. The document was found but content wasn\'t returned by the API.');
        }
      } else {
        console.log('No document details found in the response.');
      }
      
      return data;
    } else {
      const text = await response.text();
      console.log(`Error response: ${text}`);
      return null;
    }
  } catch (error) {
    console.error(`Request failed: ${error.message}`);
    return null;
  }
}

// Search for Project Doc
searchGoogleDoc('Project Doc');
