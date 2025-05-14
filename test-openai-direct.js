/**
 * Direct test of OpenAI API (image generation)
 * 
 * This script directly calls OpenAI API to generate an image,
 * bypassing any application logic or middleware.
 * 
 * Run with: node test-openai-direct.js
 */

import OpenAI from 'openai';

async function testOpenAIImageGeneration() {
  try {
    // Log environment variable presence without exposing the key
    const apiKey = process.env.OPENAI_API_KEY;
    console.log(`OpenAI API key available: ${apiKey ? 'Yes' : 'No'} (length: ${apiKey?.length || 0})`);
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is missing');
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey });
    console.log('OpenAI client initialized successfully');
    
    // Start image generation
    console.log(`Generating image with dall-e-3 model...`);
    const startTime = Date.now();
    
    const result = await openai.images.generate({
      model: "dall-e-3",
      prompt: "a delicious burger with fries on a plate",
      n: 1,
      size: "1024x1024",
      response_format: "b64_json"
    });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`Image generation completed in ${duration.toFixed(2)} seconds`);
    
    // Check if we have data in the response
    if (!result?.data || !Array.isArray(result.data) || result.data.length === 0) {
      throw new Error("No image data returned from API");
    }
    
    // Get the base64 data from the response
    const base64Data = result.data[0]?.b64_json;
    
    if (!base64Data) {
      throw new Error("No base64 image data returned from API");
    }
    
    console.log(`Successfully received base64 data with length: ${base64Data.length}`);
    console.log('Test completed successfully');
    
  } catch (error) {
    console.error('Error in OpenAI test:', error);
  }
}

// Run the test
testOpenAIImageGeneration();