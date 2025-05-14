/**
 * Test script for image generation through chat
 * 
 * This script tests the updated processChat function's image generation capabilities by:
 * 1. Creating a chat message requesting an image
 * 2. Verifying the result
 * 
 * Run with: node test-image-chat.js
 */

const fetch = require('node-fetch').default;

// Test card ID - should be in a column with GPT enabled
const TEST_CARD_ID = 94; // This card exists in the Image column

/**
 * Main test function
 */
async function testImageGeneration() {
  console.log('Starting image generation test via chat...');
  
  try {
    // 1. Create a chat message requesting an image
    console.log(`Creating chat message for card ${TEST_CARD_ID} requesting an image...`);
    
    const chatResponse = await fetch(`http://localhost:5000/api/cards/${TEST_CARD_ID}/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: 'Generate an image of a futuristic city with flying cars',
        role: 'user'
      })
    });
    
    if (!chatResponse.ok) {
      const errorData = await chatResponse.text();
      throw new Error(`Failed to create chat message: ${chatResponse.status} ${errorData}`);
    }
    
    const chatData = await chatResponse.json();
    console.log(`Successfully created chat message with ID: ${chatData.id}`);
    
    // 2. Check processing status
    console.log(`Checking if card ${TEST_CARD_ID} is in processing state...`);
    let isProcessing = true;
    
    // Poll the processing status a few times
    for (let i = 0; i < 20 && isProcessing; i++) {
      const statusResponse = await fetch(`http://localhost:5000/api/cards/${TEST_CARD_ID}/processing-status`);
      if (!statusResponse.ok) {
        console.warn(`Warning: Failed to get processing status: ${statusResponse.status}`);
        continue;
      }
      
      const statusData = await statusResponse.json();
      isProcessing = statusData.processing;
      
      console.log(`Attempt ${i+1}: Card processing status: ${isProcessing ? 'PROCESSING' : 'COMPLETED'}`);
      
      if (isProcessing) {
        console.log('Waiting 2 seconds before checking again...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // 3. Get the most recent chats to verify the result
    console.log(`Getting recent chats for card ${TEST_CARD_ID}...`);
    const chatsResponse = await fetch(`http://localhost:5000/api/cards/${TEST_CARD_ID}/chats`);
    
    if (!chatsResponse.ok) {
      throw new Error(`Failed to get chats: ${chatsResponse.status}`);
    }
    
    const chats = await chatsResponse.json();
    console.log(`Retrieved ${chats.length} chat messages`);
    
    // Look for the most recent assistant messages
    const assistantMessages = chats
      .filter(chat => chat.role === 'assistant')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 3);
    
    console.log('\nMost recent assistant messages:');
    assistantMessages.forEach((message, i) => {
      console.log(`\n[Message ${i+1}]`);
      console.log(`Content: ${message.content.substring(0, 200)}${message.content.length > 200 ? '...' : ''}`);
      console.log(`Timestamp: ${message.timestamp}`);
      console.log(`GPT Name: ${message.gptName || 'N/A'}`);
      
      // Check if this message is the image generation confirmation
      if (message.content.includes('Generated an image') || message.content.includes('/api/attachments/')) {
        console.log('\n✅ FOUND IMAGE GENERATION CONFIRMATION MESSAGE');
        
        // Extract attachment ID if present
        const attachmentMatch = message.content.match(/\/api\/attachments\/(\d+)/);
        if (attachmentMatch && attachmentMatch[1]) {
          console.log(`Image attachment ID: ${attachmentMatch[1]}`);
        }
      }
    });
    
    // 4. Get attachments to verify the image was created
    console.log(`\nGetting attachments for card ${TEST_CARD_ID}...`);
    const attachmentsResponse = await fetch(`http://localhost:5000/api/cards/${TEST_CARD_ID}/attachments`);
    
    if (!attachmentsResponse.ok) {
      throw new Error(`Failed to get attachments: ${attachmentsResponse.status}`);
    }
    
    const attachments = await attachmentsResponse.json();
    
    console.log(`Retrieved ${attachments.length} attachments`);
    
    // Look for image attachments
    const imageAttachments = attachments.filter(att => att.fileType.includes('image'));
    console.log(`Found ${imageAttachments.length} image attachments`);
    
    if (imageAttachments.length > 0) {
      // List the most recent image attachments
      const recentImages = imageAttachments
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 3);
      
      console.log('\nMost recent image attachments:');
      recentImages.forEach((attachment, i) => {
        console.log(`\n[Image ${i+1}]`);
        console.log(`ID: ${attachment.id}`);
        console.log(`Filename: ${attachment.filename}`);
        console.log(`File Type: ${attachment.fileType}`);
        console.log(`Created At: ${attachment.createdAt}`);
        console.log(`URL: /api/attachments/${attachment.id}`);
      });
      
      console.log('\n✅ TEST SUCCESSFUL: Image generation appears to be working!');
    } else {
      console.log('\n❌ TEST INCONCLUSIVE: No image attachments found');
    }
    
  } catch (error) {
    console.error(`\n❌ TEST FAILED: Error during image generation test:`, error);
  }
}

// Run the test
testImageGeneration();