/**
 * Quick test for image generation with minimal prompt
 */
import { generateImage } from './server/openai';

async function quickImageTest() {
  console.log('Starting quick image test...');
  
  try {
    // Very short, simple prompt
    const prompt = 'red circle';
    
    console.log(`Using minimal prompt: "${prompt}"`);
    console.log('Calling generateImage function...');
    
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
quickImageTest();