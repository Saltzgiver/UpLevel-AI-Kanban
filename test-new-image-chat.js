/**
 * Test script for the updated image generation in card chats
 * 
 * This script tests the updated image generation functionality with the
 * gpt-image-1 model, 1024x1024 size, and medium quality parameters.
 */

import fetch from 'node-fetch';

// Configuration
const TEST_CARD_ID = 94; // Card ID from the "Image" column (21)
const TEST_PROMPT = 'Generate an image of a beautiful mountain landscape with a lake at sunset';

async function testImageGeneration() {
  try {
    console.log('=== TESTING UPDATED IMAGE GENERATION IN CARD CHATS ===');
    console.log(`Using card ID: ${TEST_CARD_ID}`);
    console.log(`Test prompt: "${TEST_PROMPT}"`);
    
    // Step 1: Create a chat message requesting an image
    console.log('\nStep 1: Creating chat message...');
    
    const chatResponse = await fetch(`http://localhost:5000/api/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cardId: TEST_CARD_ID,
        content: TEST_PROMPT,
        role: 'user'
      })
    });
    
    if (!chatResponse.ok) {
      throw new Error(`Failed to create chat message: ${chatResponse.status} ${await chatResponse.text()}`);
    }
    
    const chatData = await chatResponse.json();
    console.log(`Chat message created with ID: ${chatData.id}`);
    
    // Step 2: Trigger processing
    console.log('\nStep 2: Triggering processing...');
    
    const processResponse = await fetch(`http://localhost:5000/api/cards/${TEST_CARD_ID}/process-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: TEST_PROMPT
      })
    });
    
    if (!processResponse.ok) {
      throw new Error(`Failed to process chat: ${processResponse.status} ${await processResponse.text()}`);
    }
    
    console.log('Processing triggered successfully');
    
    // Step 3: Poll the processing status
    console.log('\nStep 3: Polling processing status...');
    
    let isProcessing = true;
    let attempts = 0;
    const maxAttempts = 30;  // 30 seconds timeout
    
    while (isProcessing && attempts < maxAttempts) {
      attempts++;
      
      await new Promise(resolve => setTimeout(resolve, 1000));  // Wait 1 second
      
      const statusResponse = await fetch(`http://localhost:5000/api/cards/${TEST_CARD_ID}/processing-status`);
      
      if (!statusResponse.ok) {
        console.log(`Warning: Failed to get processing status: ${statusResponse.status}`);
        continue;
      }
      
      const statusData = await statusResponse.json();
      isProcessing = statusData.processing;
      
      console.log(`Attempt ${attempts}/${maxAttempts}: Card is ${isProcessing ? 'still processing' : 'done processing'}`);
      
      if (!isProcessing) {
        break;
      }
    }
    
    if (isProcessing) {
      console.log('Warning: Processing timeout reached. The operation might still be running.');
    } else {
      console.log('Processing completed successfully!');
    }
    
    // Step 4: Get the latest chats to look for the image generation result
    console.log('\nStep 4: Checking latest chats for image attachment...');
    
    const chatsResponse = await fetch(`http://localhost:5000/api/cards/${TEST_CARD_ID}/chats`);
    
    if (!chatsResponse.ok) {
      throw new Error(`Failed to get chats: ${chatsResponse.status}`);
    }
    
    const chats = await chatsResponse.json();
    
    // Display the latest few chats
    console.log(`\nLatest chats (${chats.length} total):`);
    
    chats.slice(-5).forEach((chat, i) => {
      console.log(`Chat #${chats.length - 4 + i}: ${chat.role}: ${chat.content.substring(0, 100)}${chat.content.length > 100 ? '...' : ''}`);
    });
    
    // Step 5: Get card attachments
    console.log('\nStep 5: Checking card attachments...');
    
    const cardResponse = await fetch(`http://localhost:5000/api/cards/${TEST_CARD_ID}`);
    
    if (!cardResponse.ok) {
      throw new Error(`Failed to get card: ${cardResponse.status}`);
    }
    
    const card = await cardResponse.json();
    
    if (card.attachments && card.attachments.length > 0) {
      console.log(`Found ${card.attachments.length} attachments`);
      
      // Look for image attachments
      const imageAttachments = card.attachments.filter(att => att.fileType.includes('image'));
      
      if (imageAttachments.length > 0) {
        console.log(`✅ SUCCESS: Found ${imageAttachments.length} image attachments`);
        
        // Log some details about the images
        imageAttachments.forEach(img => {
          console.log(`- Image: ${img.filename} (${img.fileType})`);
        });
      } else {
        console.log('❌ No image attachments found. Image generation might have failed.');
      }
    } else {
      console.log('❌ No attachments found. Image generation might have failed.');
    }
    
    console.log('\n=== TEST COMPLETED ===');
    
  } catch (error) {
    console.error(`\n❌ TEST FAILED: Error during image generation test: ${error.message}`);
    console.error(error);
  }
}

// Run the test
testImageGeneration();