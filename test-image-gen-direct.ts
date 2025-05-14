/**
 * Direct test script for the generateImage function
 * 
 * This script uses tsx to directly execute TypeScript code that tests the image generation function
 */

import { generateImage } from './server/openai';
import * as fs from 'fs';
import * as path from 'path';

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
    
    // Save the generated image to a file for visual inspection
    const outputPath = './test-image.png';
    fs.writeFileSync(outputPath, Buffer.from(result.base64, 'base64'));
    
    console.log(`Image saved to: ${outputPath}`);
    console.log('Test completed successfully!');
    
  } catch (error) {
    console.error('Error during image generation test:', error);
  }
}

// Run the test
testImageGeneration();