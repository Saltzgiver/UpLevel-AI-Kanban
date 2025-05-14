/**
 * Basic test for image generation functionality
 * This script doesn't timeout or save the image - it just tests the function end-to-end
 */

import { generateImage } from './server/openai';

async function testImageGeneration() {
  console.log('Starting basic image generation test...');
  
  try {
    // Simple test prompt
    const prompt = 'A colorful sunset over mountains';
    
    console.log(`Using prompt: "${prompt}"`);
    console.log('Calling generateImage function - this may take a minute...');
    
    // Call the generateImage function
    const result = await generateImage(prompt);
    
    console.log('Image generation successful!');
    
    if (result && result.base64) {
      console.log(`Received base64 data of length: ${result.base64.length}`);
      console.log(`File type: ${result.fileType}`);
      console.log('Test completed successfully!');
    }
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error during image generation test:', error.message);
    } else {
      console.error('Unknown error during image generation test');
    }
  }
}

// Run the test
testImageGeneration();