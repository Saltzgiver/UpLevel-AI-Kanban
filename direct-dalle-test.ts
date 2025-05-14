/**
 * Direct test for DALL-E 3 functionality
 */
import OpenAI from "openai";

async function directDalleTest() {
  console.log('Starting direct DALL-E 3 test...');
  
  try {
    // Initialize the OpenAI client
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Very simple prompt
    const prompt = 'red circle';
    
    console.log(`Using minimal prompt: "${prompt}"`);
    console.log('Calling DALL-E 3 directly...');
    
    // Call OpenAI API directly with dall-e-3 model
    const result = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json"
    });
    
    console.log('Image generation successful!');
    const base64Data = result.data[0]?.b64_json;
    
    if (base64Data) {
      console.log(`Received base64 data of length: ${base64Data.length}`);
      console.log('Test completed successfully!');
    } else {
      console.log('No base64 data received.');
    }
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error during DALL-E 3 test:', error.message);
    } else {
      console.error('Unknown error during DALL-E 3 test');
    }
  }
}

// Run the test
directDalleTest();