/**
 * Simple test script for image generation functionality
 * This script doesn't save the image to disk - it just verifies the function runs
 */

import { generateImage } from './server/openai';

// Define the type for our image generation result
type ImageResult = {
  base64: string;
  fileType: string;
};

async function testImageGeneration() {
  try {
    console.log('Starting simple image generation test...');
    
    // Simple test prompt
    const prompt = 'A colorful sunset over mountains';
    
    console.log(`Using short prompt: "${prompt}"`);
    
    // Call the generateImage function with a longer timeout for DALL-E
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout after 60 seconds')), 60000);
    });
    
    const generationPromise = generateImage(prompt);
    
    // Race the promises
    const result = await Promise.race([generationPromise, timeoutPromise]);
    
    console.log('Image generation successful!');
    
    // Type guard to ensure we have the right properties
    if (result && typeof result === 'object' && 'base64' in result) {
      const imageResult = result as ImageResult;
      console.log(`Received base64 data of length: ${imageResult.base64.length}`);
      console.log(`File type: ${imageResult.fileType}`);
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