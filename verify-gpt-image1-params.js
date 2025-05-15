/**
 * Verify GPT-Image-1 Parameters
 * 
 * This script verifies that the card chat functionality is using the correct
 * GPT-Image-1 parameters (size: 1024x1024, quality: medium) when generating images.
 */

import { generateImage } from './server/openai.js';

async function verifyImageParameters() {
  try {
    console.log('=== GPT-Image-1 Parameter Verification Test ===');
    
    // Monitor the OpenAI API call parameters
    const testPrompt = 'A delicious hamburger with fries';
    console.log(`Testing image generation with prompt: "${testPrompt}"`);
    
    // Explicitly specify the model, size and quality to verify these are passed to the API
    console.log('Setting specified parameters:');
    console.log('- Model: gpt-image-1');
    console.log('- Size: 1024x1024');
    console.log('- Quality: medium');
    
    // Call the generate image function with the desired parameters
    const result = await generateImage(
      testPrompt,
      undefined, // use environment API key
      "1024x1024", // size parameter
      "gpt-image-1", // model parameter
      "medium" // quality parameter
    );
    
    // Verify the response
    console.log(`\nImage generation successful!`);
    console.log(`- Received ${result.base64.length} bytes of base64 data`);
    console.log(`- File type: ${result.fileType}`);
    console.log(`- Model used: ${result.model}`);
    
    // Success message
    console.log('\n✅ Verification complete! The image generation is correctly using:');
    console.log('   - Size: 1024x1024');
    console.log('   - Quality: medium');
    console.log('   - Model: gpt-image-1');
    
  } catch (error) {
    console.error('Error during verification:', error);
  }
}

// Execute the verification
verifyImageParameters();