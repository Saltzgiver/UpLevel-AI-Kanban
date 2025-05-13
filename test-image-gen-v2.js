// Test script for image generation with enhanced logging
import fetch from 'node-fetch';

// We'll use a card that we know exists in the database
const CARD_ID = 100; // Update this to a card ID that exists in your database
const TEST_PROMPT = 'Generate an image of a futuristic cityscape with flying cars and neon lights';

async function testImageGeneration() {
  try {
    console.log('Starting image generation test with enhanced logging...');
    
    // First, make a direct API call to create a chat for our card
    console.log(`Creating chat message for card ${CARD_ID} with prompt: ${TEST_PROMPT}`);
    
    // Get the current chats first to confirm our message was added
    const beforeChatsResp = await fetch(`http://localhost:5000/api/cards/${CARD_ID}/processing-status`);
    const beforeData = await beforeChatsResp.json();
    const chatCountBefore = beforeData.chats ? beforeData.chats.length : 0;
    console.log(`Card has ${chatCountBefore} messages before our test`);
    
    // Create our image request chat message
    const response = await fetch(`http://localhost:5000/api/cards/${CARD_ID}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: TEST_PROMPT
      }),
    });
    
    if (!response.ok) {
      console.log(`Response status: ${response.status}`);
      console.log(`Response text: ${await response.text()}`);
      throw new Error(`Failed to create chat message: ${response.status} ${response.statusText}`);
    }
    
    console.log('Chat message created successfully');
    
    // Then update the card to mark it as processing
    const updateResponse = await fetch(`http://localhost:5000/api/cards/${CARD_ID}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        processing: true
      }),
    });
    
    if (!updateResponse.ok) {
      throw new Error(`Failed to update card: ${updateResponse.status} ${updateResponse.statusText}`);
    }
    
    console.log('Card marked as processing');
    
    // Then trigger the custom image processing
    const processResponse = await fetch(`http://localhost:5000/api/cards/${CARD_ID}/trigger-gpt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!processResponse.ok) {
      throw new Error(`Failed to trigger processing: ${processResponse.status} ${processResponse.statusText}`);
    }
    
    console.log('Processing triggered successfully');
    
    // Poll for status updates
    let done = false;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (!done && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(`http://localhost:5000/api/cards/${CARD_ID}/processing-status`);
      if (!statusResponse.ok) {
        throw new Error(`Failed to get status: ${statusResponse.status} ${statusResponse.statusText}`);
      }
      
      const status = await statusResponse.json();
      console.log(`Status check (attempt ${attempts + 1}/${maxAttempts}):`);
      console.log(`- Processing: ${status.processing}`);
      console.log(`- Has output: ${status.gptOutput ? 'Yes' : 'No'}`);
      
      if (status.attachments) {
        console.log(`- Attachments: ${status.attachments.length}`);
        if (status.attachments.length > 0) {
          console.log('  Attachment details:');
          status.attachments.forEach((att, i) => {
            console.log(`  [${i+1}] ID: ${att.id}, Filename: ${att.filename}, Type: ${att.fileType}`);
          });
        }
      }
      
      if (status.chats) {
        console.log(`- Chat messages: ${status.chats.length}`);
        // Show last chat message if available
        if (status.chats.length > 0) {
          const lastChat = status.chats[status.chats.length - 1];
          console.log(`  Last message from ${lastChat.role}: ${lastChat.content.substring(0, 100)}${lastChat.content.length > 100 ? '...' : ''}`);
          
          // Look for image markdown in the content
          if (lastChat.role === 'assistant') {
            const imageRegex = /!\[.*?\]\((.*?)\)/;
            const match = lastChat.content.match(imageRegex);
            if (match) {
              console.log(`  Found image URL in message: ${match[1]}`);
            }
          }
        }
      }
      
      // Check if processing is completed and we have a chat response
      if (!status.processing && status.chats && status.chats.length > 0) {
        const lastChat = status.chats[status.chats.length - 1];
        if (lastChat.role === 'assistant') {
          console.log('Processing completed with assistant response!');
          done = true;
        }
      }
      
      attempts++;
    }
    
    if (!done) {
      console.log('Timed out waiting for processing to complete');
    } else {
      // Get final attachments to check image details
      const attachmentsResponse = await fetch(`http://localhost:5000/api/cards/${CARD_ID}/attachments`);
      const attachments = await attachmentsResponse.json();
      
      console.log(`\nFinal attachments count: ${attachments.length}`);
      attachments.forEach((att, i) => {
        console.log(`Attachment ${i+1}:`);
        console.log(`- ID: ${att.id}`);
        console.log(`- Filename: ${att.filename}`);
        console.log(`- File Type: ${att.fileType}`);
        console.log(`- Created: ${att.createdAt}`);
      });
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testImageGeneration();