/**
 * Simple test script for image generation functionality
 * This script doesn't save the image to disk - it just verifies the function runs
 */

import { generateImage } from './server/openai';

async function testImageGeneration() {
  try {
    console.log('Starting simple image generation test...');
    
    // Simple test prompt
    const prompt = 'A colorful sunset over mountains';
    
    console.log(`Using short prompt: "${prompt}"`);
    
    // Call the generateImage function with a timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout after 30 seconds')), 30000);
    });
    
    const generationPromise = generateImage(prompt);
    
    // Race the promises
    const result = await Promise.race([generationPromise, timeoutPromise]);
    
    console.log('Image generation successful!');
    
    if (result && result.base64) {
      console.log(`Received base64 data of length: ${result.base64.length}`);
      console.log(`File type: ${result.fileType}`);
      console.log('Test passed!');
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