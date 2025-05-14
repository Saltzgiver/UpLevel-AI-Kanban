/**
 * Test script for the image generation fallback mechanism
 * 
 * This script tests the automatic fallback from gpt-image-1 to DALL-E 3
 * when an organization verification error occurs
 */

// Import required modules
import { generateImage } from "./server/openai.js";

// Test function to verify the fallback to DALL-E 3
async function testFallback() {
  try {
    console.log("Starting image fallback test...");
    console.log("Using gpt-image-1 which should trigger a fallback to DALL-E 3");
    
    // Make sure PREFER_DALLE_FALLBACK is not set
    // Initial call will use gpt-image-1 but should fallback to DALL-E 3 on error
    
    // Call the generateImage function 
    const result = await generateImage("A beautiful mountain landscape with snow and trees");
    
    console.log("Image generation completed successfully");
    console.log("----- Result -----");
    
    if (result.url) {
      console.log(`Result contains a URL (length: ${result.url.length})`);
      console.log(`First 50 characters of URL: ${result.url.substring(0, 50)}...`);
      console.log("Fallback to DALL-E 3 occurred successfully");
    } else if (result.base64) {
      console.log(`Result contains base64 data (length: ${result.base64.length})`);
      console.log(`First 50 characters of base64: ${result.base64.substring(0, 50)}...`);
      console.log("Used gpt-image-1 directly (no fallback occurred)");
    }
    
    console.log(`File type: ${result.fileType}`);
    console.log("----- End Result -----");
    
    return result;
  } catch (error) {
    console.error("Error testing image fallback:", error);
    throw error;
  }
}

// Run the test
(async () => {
  try {
    console.log("====== AUTO FALLBACK IMAGE GENERATION TEST ======");
    await testFallback();
    console.log("Auto fallback test completed successfully");
    console.log("====== END TEST ======");
  } catch (error) {
    console.error("Test failed with error:", error);
    process.exit(1);
  }
})();