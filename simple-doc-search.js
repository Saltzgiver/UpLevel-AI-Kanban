/**
 * Simple direct test to search for Project Doc and save the full result
 */

async function searchDoc() {
  try {
    console.log('Making direct request to Zapier MCP endpoint to search for "Project Doc"...');
    
    const endpoint = process.env.ZAPIER_MCP_ENDPOINT;
    if (!endpoint) throw new Error('ZAPIER_MCP_ENDPOINT environment variable is not set');
    const query = 'Project Doc';
    
    // Build URL with query parameters (GET method)
    const url = `${endpoint}?action=google_docs.find_document&query=${encodeURIComponent(query)}`;
    
    console.log(`Request URL: ${url}`);
    
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const duration = Date.now() - startTime;
    
    console.log(`Response status: ${response.status} ${response.statusText} (took ${duration}ms)`);
    
    const text = await response.text();
    console.log(`Raw response (first 1000 chars): ${text.substring(0, 1000)}`);
    
    try {
      // Try to parse the response as JSON
      const data = JSON.parse(text);
      console.log('\nParsed response:');
      
      if (data.success) {
        console.log('✅ Search successful!');
        
        if (data.document) {
          console.log('\nDocument found:');
          console.log(`Name: ${data.document.name}`);
          console.log(`URL: ${data.document.url}`);
          console.log(`Owner: ${data.document.owner}`);
          console.log(`Last Modified: ${data.document.lastModified}`);
          
          if (data.document.content) {
            console.log('\nDocument content (first 500 chars):');
            console.log('------------------');
            console.log(data.document.content.substring(0, 500));
            console.log('------------------');
          } else {
            console.log('\nNo document content available');
          }
        } else {
          console.log('No document data in the response');
        }
      } else {
        console.log('⚠️ Search unsuccessful');
        console.log(`Error: ${data.error || 'No error message'}`);
      }
    } catch (parseError) {
      console.error(`Failed to parse response as JSON: ${parseError.message}`);
    }
  } catch (error) {
    console.error(`Request failed: ${error.message}`);
  }
}

// Run the search
searchDoc();
