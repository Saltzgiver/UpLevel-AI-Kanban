/**
 * Test script for the generateImage function in server/openai.ts
 * This script directly tests the image generation functionality using the gpt-image-1 model
 */

// Import required modules
const { generateImage } = require('../../dist/server/openai.js');
const fs = require('fs');
const path = require('path');

/**
 * Main test function
 */
async function testImageGeneration() {
  try {
    console.log('Starting image generation test...');
    
    // Simple test prompt
    const prompt = 'A futuristic cityscape with flying cars and neon lights';
    
    console.log(`Using prompt: "${prompt}"`);
    console.log('Calling generateImage function...');
    
    // Call the generateImage function
    const result = await generateImage(prompt);
    
    console.log('Image generation successful!');
    console.log(`Received base64 data of length: ${result.base64.length}`);
    console.log(`File type: ${result.fileType}`);
    
    // Optional: Save the generated image to a file for visual inspection
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = path.join(outputDir, 'test-image.png');
    fs.writeFileSync(outputPath, Buffer.from(result.base64, 'base64'));
    
    console.log(`Image saved to: ${outputPath}`);
    console.log('Test completed successfully!');
    
  } catch (error) {
    console.error('Error during image generation test:', error);
  }
}

// Run the test
testImageGeneration();