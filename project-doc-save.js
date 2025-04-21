/**
 * Test for retrieving "Project Doc" and saving the response to a file
 */
import fs from 'fs';
const endpoint = process.env.ZAPIER_MCP_ENDPOINT || 'https://actions.zapier.com/mcp/REDACTED/sse';

async function searchGoogleDocAndSave(query) {
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
      console.log('✅ Success! Saving response to file...');
      
      // Save response to a file
      fs.writeFileSync('project-doc-response.json', JSON.stringify(data, null, 2));
      console.log('Saved response to project-doc-response.json');
      
      // Also display the document details
      if (data.document) {
        console.log('\nDocument details:');
        console.log(`Name: ${data.document.name}`);
        console.log(`URL: ${data.document.url}`);
        console.log(`Owner: ${data.document.owner}`);
        console.log(`Last Modified: ${data.document.lastModified}`);
        
        if (data.document.content) {
          console.log('\nContent:');
          console.log(data.document.content);
        } else {
          console.log('\nNo content available in the response.');
        }
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
searchGoogleDocAndSave('Project Doc')
  .catch(error => console.error(error));
