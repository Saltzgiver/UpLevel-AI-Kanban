// Test script for image generation
const fetch = require('node-fetch');

async function testImageGeneration() {
  try {
    console.log('Starting image generation test...');
    
    // First, create a chat message
    const chatResponse = await fetch('http://localhost:5000/api/chats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cardId: 47,
        content: 'Generate an image of a mountain landscape with sunset colors',
        role: 'user'
      }),
    });
    
    if (!chatResponse.ok) {
      throw new Error(`Failed to create chat: ${chatResponse.status} ${chatResponse.statusText}`);
    }
    
    const chatData = await chatResponse.json();
    console.log('Chat created:', chatData);
    
    // Then trigger processing
    const processResponse = await fetch(`http://localhost:5000/api/cards/47/process-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Generate an image of a mountain landscape with sunset colors'
      }),
    });
    
    if (!processResponse.ok) {
      throw new Error(`Failed to process chat: ${processResponse.status} ${processResponse.statusText}`);
    }
    
    console.log('Processing triggered successfully');
    
    // Poll for status updates
    let done = false;
    let attempts = 0;
    
    while (!done && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`http://localhost:5000/api/cards/47/processing-status`);
      if (!statusResponse.ok) {
        throw new Error(`Failed to get status: ${statusResponse.status} ${statusResponse.statusText}`);
      }
      
      const status = await statusResponse.json();
      console.log(`Status (attempt ${attempts + 1}):`, JSON.stringify(status));
      
      // Check if processing is completed
      if (!status.processing && (status.chats.length > 1 || status.attachments.length > 0)) {
        console.log('Processing completed!');
        console.log('Final status:', JSON.stringify(status, null, 2));
        done = true;
      }
      
      attempts++;
    }
    
    if (!done) {
      console.log('Timed out waiting for processing to complete');
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testImageGeneration();