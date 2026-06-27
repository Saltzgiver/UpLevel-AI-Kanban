/**
 * Direct test for Google Docs MCP integration
 * 
 * This script creates a direct test of the Google Docs handler without
 * going through the full MCP flow.
 */

// Access environment variables
if (!process.env.ZAPIER_MCP_ENDPOINT) { console.error('ZAPIER_MCP_ENDPOINT environment variable is not set'); process.exit(1); }

// Import required modules
import fetch from 'node-fetch';
import crypto from 'crypto';

// Simplified MCP client for direct testing
async function searchGoogleDocs(query) {
  console.log(`🔍 Searching for Google Doc with query: "${query}"`);
  
  try {
    const endpoint = process.env.ZAPIER_MCP_ENDPOINT;
    if (!endpoint) {
      throw new Error('ZAPIER_MCP_ENDPOINT is not configured');
    }
    
    console.log(`Using Zapier endpoint: ${endpoint}`);
    
    const payload = JSON.stringify({
      action: 'google_docs.find_document',
      query: query
    });
    
    console.log(`Sending payload: ${payload}`);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: payload
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`HTTP error: ${response.status} ${response.statusText}`);
      console.error(`Response body: ${errorText}`);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error searching Google Docs: ${error.message}`);
    if (error.cause) {
      console.error(`Error cause: ${JSON.stringify(error.cause)}`);
    }
    return null;
  }
}

// Try a few different HTTP methods to see which one works
async function tryDifferentMethods(query) {
  const endpoint = process.env.ZAPIER_MCP_ENDPOINT;
  const methods = ['POST', 'GET'];
  
  for (const method of methods) {
    console.log(`\nTrying ${method} request...`);
    
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      if (method === 'POST') {
        options.body = JSON.stringify({
          action: 'google_docs.find_document',
          query: query
        });
      }
      
      // For GET request, append query parameters
      const url = method === 'GET' 
        ? `${endpoint}?action=google_docs.find_document&query=${encodeURIComponent(query)}`
        : endpoint;
        
      console.log(`Sending ${method} request to: ${url}`);
      
      const response = await fetch(url, options);
      
      const statusText = response.ok ? '✅ SUCCESS' : '❌ FAILED';
      console.log(`${statusText} - Status: ${response.status} ${response.statusText}`);
      
      let responseText;
      try {
        responseText = await response.text();
        console.log(`Response: ${responseText}`);
      } catch (err) {
        console.log(`Could not read response: ${err.message}`);
      }
    } catch (error) {
      console.error(`Error with ${method} request: ${error.message}`);
    }
  }
}

// Main test function
async function runTest() {
  console.log('🔎 Testing Google Docs document search via Zapier MCP\n');
  
  // Search for the Project Doc
  const query = 'Project Doc';
  
  // Try the standard approach first
  console.log('• Attempting standard Google Docs search...');
  const result = await searchGoogleDocs(query);
  
  if (result) {
    console.log('✅ Successfully found document:');
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  console.log('\n• Standard search failed, trying alternative HTTP methods...');
  await tryDifferentMethods(query);
  
  console.log('\n• Testing complete');
}

// Run the test
runTest();
