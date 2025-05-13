/**
 * Test script for the new gpt-image-1 image generation model
 * 
 * This script tests the updated image generation functionality by:
 * 1. Creating a chat message requesting an image
 * 2. Processing the chat with the image generation system
 * 3. Verifying the result
 */

import fetch from 'node-fetch';

async function testImageGeneration() {
  try {
    console.log('Starting image generation test with the newest gpt-image-1 model...');
    
    // First, create a chat message on an existing card
    const cardId = 101; // Use an existing card ID
    const imagePrompt = 'Generate an image of a futuristic city with flying cars and neon lights at night';
    
    console.log(`Creating chat message for card ${cardId} with prompt: ${imagePrompt}`);
    
    const chatResponse = await fetch('http://localhost:5000/api/chats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cardId: cardId,
        content: imagePrompt,
        role: 'user'
      }),
    });
    
    if (!chatResponse.ok) {
      throw new Error(`Failed to create chat: ${chatResponse.status} ${chatResponse.statusText}`);
    }
    
    const chatData = await chatResponse.json();
    console.log('Chat created:', chatData);
    
    // Then trigger processing
    console.log(`Triggering image generation processing for card ${cardId}...`);
    const processResponse = await fetch(`http://localhost:5000/api/cards/${cardId}/process-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: imagePrompt
      }),
    });
    
    if (!processResponse.ok) {
      throw new Error(`Failed to process chat: ${processResponse.status} ${processResponse.statusText}`);
    }
    
    console.log('Processing triggered successfully, now waiting for the image generation to complete');
    
    // Poll for status updates
    let done = false;
    let attempts = 0;
    let maxAttempts = 30;
    
    while (!done && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between checks
      
      const statusResponse = await fetch(`http://localhost:5000/api/cards/${cardId}/processing-status`);
      const statusData = await statusResponse.json();
      
      attempts++;
      console.log(`Checking status (attempt ${attempts}/${maxAttempts}): processing=${statusData.processing}`);
      
      if (!statusData.processing) {
        done = true;
        // Get the card to see if it has new attachments
        const cardResponse = await fetch(`http://localhost:5000/api/cards/${cardId}`);
        const card = await cardResponse.json();
        
        if (card.attachments && card.attachments.length > 0) {
          // Find the latest attachment
          const latestAttachment = card.attachments.sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          })[0];
          
          console.log('===== TEST SUCCESSFUL =====');
          console.log(`Image generated successfully! Attachment ID: ${latestAttachment.id}`);
          console.log(`Filename: ${latestAttachment.filename}`);
          console.log(`Image URL: http://localhost:5000/api/attachments/${latestAttachment.id}`);
        } else {
          console.log('===== TEST FAILED =====');
          console.log('No attachments found on the card after processing');
        }
      }
    }
    
    if (!done) {
      console.log('===== TEST FAILED =====');
      console.log(`Failed to complete image generation after ${maxAttempts} attempts`);
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Run the test
testImageGeneration();