/**
 * Direct Test for Google Docs MCP Integration
 * 
 * This script tests the Google Docs MCP action directly by:
 * 1. Getting the details of our existing test card (ID: 95)
 * 2. Using the googleDocsHandler to simulate a search request
 * 3. Logging the results and any errors
 */

import { handleGoogleDocsSearch } from './server/googleDocsHandler.ts';

// Test arguments for the Google Docs search
const testArgs = {
  query: "Recipe Collection"
};

async function runDirectTest() {
  console.log("🔍 Testing Google Docs search directly...");
  console.log(`Search query: "${testArgs.query}"`);
  
  try {
    console.log("\nCalling handleGoogleDocsSearch function...");
    const result = await handleGoogleDocsSearch(testArgs);
    console.log("\n✅ Result from Google Docs search:");
    console.log(result);
  } catch (error) {
    console.error("\n❌ Error occurred during Google Docs search:");
    console.error(error);
    
    // Try to get more details if it's an HTTP error
    if (error.cause && error.cause.code) {
      console.error(`Error code: ${error.cause.code}`);
    }
  }
  
  console.log("\nTest completed.");
}

// Run the test
runDirectTest();
