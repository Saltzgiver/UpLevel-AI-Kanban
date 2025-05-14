/**
 * Test script for the enhanced handleFileGeneration function
 * 
 * This script tests the image processing capabilities of the handleFileGeneration function
 * by providing sample image data in both base64 and URL formats.
 * 
 * Run with: npx tsx test-handle-file-generation.js
 */

import { storage } from './server/storage';
import { handleFileGeneration } from './server/openai';

// Test card ID - using a valid card ID from the database
const TEST_CARD_ID = 94;  // ID 94 exists in column 21 ('Image' column)

// Base64 encoded PNG image (1x1 pixel, transparent)
const SAMPLE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// Public test image URL
const SAMPLE_IMAGE_URL = 'https://httpbin.org/image/png';

// Sample response text that might contain an image generation request
const SAMPLE_RESPONSE = 'I have generated an image of "a colorful sunset over mountains" based on your request.';

/**
 * Tests handleFileGeneration with base64 image data (gpt-image-1 case)
 */
async function testHandleFileGenerationWithBase64() {
  console.log('=== Testing handleFileGeneration with base64 image data ===');
  
  try {
    // Call the handleFileGeneration function with our test data
    await handleFileGeneration(
      TEST_CARD_ID,
      SAMPLE_RESPONSE,
      {
        base64: SAMPLE_BASE64,
        fileType: 'image/png'
      }
    );
    
    // Fetch the card to verify attachments and chat messages
    const card = await storage.getCardById(TEST_CARD_ID);
    
    console.log(`Card attachments: ${card.attachments?.length || 0}`);
    if (card.attachments && card.attachments.length > 0) {
      const attachment = card.attachments[card.attachments.length - 1];
      console.log(`Latest attachment: ${attachment.id} (${attachment.filename})`);
    }
    
    console.log(`Card chats: ${card.chats?.length || 0}`);
    if (card.chats && card.chats.length > 0) {
      const chat = card.chats[card.chats.length - 1];
      console.log(`Latest chat: ${chat.role} - ${chat.content.substring(0, 100)}...`);
    }
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

/**
 * Tests handleFileGeneration with image URL (DALL-E 3 fallback case)
 */
async function testHandleFileGenerationWithUrl() {
  console.log('\n=== Testing handleFileGeneration with image URL ===');
  
  try {
    // Call the handleFileGeneration function with our test data
    await handleFileGeneration(
      TEST_CARD_ID,
      SAMPLE_RESPONSE,
      {
        url: SAMPLE_IMAGE_URL
      }
    );
    
    // Fetch the card to verify attachments and chat messages
    const card = await storage.getCardById(TEST_CARD_ID);
    
    console.log(`Card attachments: ${card.attachments?.length || 0}`);
    if (card.attachments && card.attachments.length > 0) {
      const attachment = card.attachments[card.attachments.length - 1];
      console.log(`Latest attachment: ${attachment.id} (${attachment.filename})`);
    }
    
    console.log(`Card chats: ${card.chats?.length || 0}`);
    if (card.chats && card.chats.length > 0) {
      const chat = card.chats[card.chats.length - 1];
      console.log(`Latest chat: ${chat.role} - ${chat.content.substring(0, 100)}...`);
    }
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the tests
async function runTests() {
  console.log('===== HANDLE FILE GENERATION TEST =====');
  await testHandleFileGenerationWithBase64();
  await testHandleFileGenerationWithUrl();
  console.log('===== TEST COMPLETE =====');
}

runTests();