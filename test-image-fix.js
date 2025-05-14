/**
 * Test script for the fixed image generation functionality
 * 
 * This script tests the updated image generation to ensure that image requests
 * don't incorrectly create CSV files and correctly process image data.
 * 
 * Run with: node test-image-fix.js
 */

import fetch from 'node-fetch';

async function makeRequest(endpoint, method = 'GET', body = undefined) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    console.log(`Making ${method} request to ${endpoint}`);
    const response = await fetch(`http://localhost:5000${endpoint}`, options);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    
    // Check if the response is JSON
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      return await response.json();
    } else {
      console.log(`Response for ${endpoint} is not JSON. Content-Type: ${contentType}`);
      const text = await response.text();
      console.log(`Response text (first 100 chars): ${text.substring(0, 100)}...`);
      return { success: true, isHtml: true };
    }
  } catch (error) {
    console.error(`Error making request to ${endpoint}:`, error);
    throw error;
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main test function to verify image generation functionality
 */
async function testImageGeneration() {
  try {
    console.log('=== FIXED IMAGE GENERATION TEST ===');
    
    // First, create a test card in the Image column (ID 21)
    console.log('\nCreating test card...');
    const cardData = await makeRequest('/api/cards', 'POST', {
      title: 'Image Generation Test Card',
      description: 'Card to test the fixed image generation functionality',
      columnId: 21, // Image column ID
    });
    
    console.log(`Created test card with ID: ${cardData.id}`);
    
    // Create a chat message with an image generation request
    console.log('\nCreating chat message with image request...');
    const chatData = await makeRequest('/api/chats', 'POST', {
      cardId: cardData.id,
      content: 'Generate an image of a beautiful mountain landscape with a lake and trees',
      role: 'user'
    });
    
    console.log(`Created chat message with ID: ${chatData.id}`);
    
    // Wait for processing to start
    console.log('\nWaiting for processing to start...');
    await delay(2000);
    
    // Poll the processing status until it's done
    console.log('\nPolling processing status...');
    let isProcessing = true;
    let attempt = 0;
    
    while (isProcessing && attempt < 30) {
      attempt++;
      const statusData = await makeRequest(`/api/cards/${cardData.id}/processing-status`);
      isProcessing = statusData.processing;
      
      if (isProcessing) {
        console.log(`Card still processing (attempt ${attempt}), waiting...`);
        await delay(5000); // Wait 5 seconds before checking again
      } else {
        console.log('Processing completed!');
      }
    }
    
    if (attempt >= 30) {
      console.warn('Warning: Processing took too long, proceeding anyway');
    }
    
    // Get all attachments for the card
    console.log('\nFetching attachments...');
    
    // Instead of querying attachments directly which might return HTML,
    // we'll check for attachments in the card data
    const cardWithAttachments = await makeRequest(`/api/cards/${cardData.id}`);
    
    // Check if we have an image attachment (and not CSV)
    let hasImageAttachment = false;
    let hasCsvAttachment = false;
    let attachments = [];
    
    if (cardWithAttachments && cardWithAttachments.attachments) {
      attachments = cardWithAttachments.attachments;
      console.log(`Found ${attachments.length} attachments`);
      
      for (const attachment of attachments) {
        console.log(`Attachment: ${attachment.id}, ${attachment.filename}, ${attachment.fileType}`);
        
        if (attachment.fileType && attachment.fileType.startsWith('image/')) {
          hasImageAttachment = true;
        }
        
        if ((attachment.fileType && attachment.fileType.includes('csv')) || 
            (attachment.filename && attachment.filename.endsWith('.csv'))) {
          hasCsvAttachment = true;
        }
      }
    } else {
      console.log('No attachments found or could not retrieve card data');
    }
    
    // Get all chats for the card
    console.log('\nFetching chats...');
    const chats = await makeRequest(`/api/chats?cardId=${cardData.id}`);
    
    console.log(`Found ${chats.length} chat messages`);
    
    // Check the assistant messages to see if there's a confirmation of image generation
    let hasImageConfirmation = false;
    
    for (const chat of chats) {
      if (chat.role === 'assistant' && chat.content.includes('![')) {
        hasImageConfirmation = true;
        console.log('Found image confirmation in chat message');
      }
    }
    
    // Output results
    console.log('\n=== TEST RESULTS ===');
    console.log(`Image Attachment Created: ${hasImageAttachment ? 'YES ✓' : 'NO ❌'}`);
    console.log(`CSV Attachment Created: ${hasCsvAttachment ? 'YES ❌' : 'NO ✓'}`);
    console.log(`Image Confirmation in Chat: ${hasImageConfirmation ? 'YES ✓' : 'NO ❌'}`);
    
    if (hasImageAttachment && !hasCsvAttachment && hasImageConfirmation) {
      console.log('\n✅ TEST PASSED: The image generation fix is working correctly!');
    } else {
      console.log('\n❌ TEST FAILED: The image generation fix is not working as expected.');
      
      if (!hasImageAttachment) {
        console.log('No image attachment was created.');
      }
      
      if (hasCsvAttachment) {
        console.log('A CSV attachment was incorrectly created.');
      }
      
      if (!hasImageConfirmation) {
        console.log('No image confirmation was found in the chat messages.');
      }
    }
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
testImageGeneration();