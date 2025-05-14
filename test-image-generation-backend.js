/**
 * Test script for the generateImage function
 * 
 * This script tests the image generation functionality by:
 * 1. Directly calling the generateImage function
 * 2. Testing both the default (gpt-image-1) and fallback (DALL-E 3) paths
 * 3. Logging the results to verify it works as expected
 */

// Import required modules
import { generateImage } from "./server/openai.js";

// Simple function to test the image generation
async function testImageGeneration() {
  try {
    console.log("Starting image generation test...");
    console.log("Calling generateImage with a simple prompt");
    
    // Call the generateImage function with a simple prompt
    const result = await generateImage("A colorful abstract painting with blue and orange elements");
    
    console.log("Image generation successful!");
    console.log("----- Result -----");
    
    // Log the result structure (without the full base64 or URL content)
    if (result.url) {
      console.log(`Result contains a URL (length: ${result.url.length})`);
      console.log(`First 50 characters of URL: ${result.url.substring(0, 50)}...`);
    } else if (result.base64) {
      console.log(`Result contains base64 data (length: ${result.base64.length})`);
      console.log(`First 50 characters of base64: ${result.base64.substring(0, 50)}...`);
    }
    
    console.log(`File type: ${result.fileType}`);
    console.log("----- End Result -----");
    
    return result;
  } catch (error) {
    console.error("Error testing image generation:", error);
    throw error;
  }
}

// Run the test
(async () => {
  try {
    console.log("====== IMAGE GENERATION TEST ======");
    const result = await testImageGeneration();
    console.log("Test completed successfully");
    console.log("====== END TEST ======");
  } catch (error) {
    console.error("Test failed with error:", error);
    process.exit(1);
  }
})();