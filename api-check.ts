/**
 * Simple API connectivity check
 */
import OpenAI from "openai";

async function checkAPI() {
  console.log('Checking OpenAI API connectivity...');
  
  try {
    // Initialize the OpenAI client
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Check models endpoint instead of generating an image
    const models = await openai.models.list();
    
    console.log('API connection successful!');
    console.log(`Retrieved ${models.data.length} models`);
    
    // Check if dall-e-3 is in the list
    const dalleModel = models.data.find(model => model.id === 'dall-e-3');
    if (dalleModel) {
      console.log('DALL-E 3 model is available to your API key');
    } else {
      console.log('DALL-E 3 model was not found in the available models');
    }
    
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error checking API:', error.message);
    } else {
      console.error('Unknown error checking API');
    }
  }
}

// Run the check
checkAPI();