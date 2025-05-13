/**
 * Final test script for image generation with DALL-E fallback
 * 
 * This script is simplified to just create a chat message and trigger processing,
 * which should be enough to test the image generation functionality.
 */

import fetch from 'node-fetch';

const testImageGeneration = async () => {
  try {
    console.log('==== Starting Final Image Generation Test ====');
    
    // Configuration
    const cardId = 101; // Use an existing card
    const imagePrompt = 'Generate an image of a peaceful garden with cherry blossoms and a small pond';
    
    console.log(`Using card ID: ${cardId}`);
    console.log(`Image prompt: "${imagePrompt}"`);
    
    // Step 1: Create a chat message
    console.log('\nCreating chat message...');
    const chatResponse = await fetch('http://localhost:5000/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardId,
        content: imagePrompt,
        role: 'user'
      })
    });
    
    if (!chatResponse.ok) {
      throw new Error(`Failed to create chat: ${chatResponse.status} ${chatResponse.statusText}`);
    }
    
    const chatData = await chatResponse.json();
    console.log(`Chat created with ID: ${chatData.id}`);
    
    // Step 2: Trigger processing
    console.log('\nTriggering processing...');
    const processResponse = await fetch(`http://localhost:5000/api/cards/${cardId}/process-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: imagePrompt })
    });
    
    if (!processResponse.ok) {
      throw new Error(`Failed to process: ${processResponse.status} ${processResponse.statusText}`);
    }
    
    console.log('Processing triggered successfully');
    console.log('\nTest complete. The image generation is now processing in the background.');
    console.log('Check the application logs and UI to see the results.');
    console.log('\nAccording to your environment configuration:');
    console.log('- The system will first try gpt-image-1 if PREFER_DALLE_FALLBACK is false');
    console.log('- The system will use DALL-E 3 directly if PREFER_DALLE_FALLBACK is true');
    console.log('- If gpt-image-1 fails, it will automatically fall back to DALL-E 3');
    
  } catch (error) {
    console.error('Test error:', error);
  }
};

// Run the test
testImageGeneration().catch(console.error);