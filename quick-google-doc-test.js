/**
 * Simple direct test for Google Docs search
 */
const endpoint = 'https://actions.zapier.com/mcp/REDACTED/sse';
const query = 'Project Doc';

// Build URL with query parameters
const url = `${endpoint}?action=google_docs.find_document&query=${encodeURIComponent(query)}`;

console.log(`Making GET request to: ${url}`);

fetch(url, {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
})
.then(response => {
  console.log(`Response status: ${response.status} ${response.statusText}`);
  return response.json();
})
.then(data => {
  console.log('Response data:');
  console.log(JSON.stringify(data, null, 2));
  
  if (data.document) {
    console.log('\nDocument found:');
    console.log(`Name: ${data.document.name}`);
    console.log(`URL: ${data.document.url}`);
    if (data.document.content) {
      console.log('\nContent:');
      console.log(data.document.content.substring(0, 500) + '...');
    }
  } else {
    console.log('No document found in the response.');
  }
})
.catch(error => {
  console.error(`Error: ${error.message}`);
});
