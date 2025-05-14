/**
 * Direct TypeScript test for image generation in processChat
 * 
 * This test directly calls the server-side code without using the API.
 * 
 * Run with: npx tsx test-image-direct.ts
 */

import { processChat } from './server/openai';
import { storage } from './server/storage';
import { Column } from './shared/schema';

// Constants for testing
const TEST_CARD_ID = 94; // Card in an image-enabled column

async function testImageGeneration() {
  try {
    console.log('=== IMAGE GENERATION INTEGRATION TEST ===');
    console.log(`Testing with card ID: ${TEST_CARD_ID}`);
    
    // Get the card to find its column
    const card = await storage.getCardById(TEST_CARD_ID);
    if (!card) {
      throw new Error(`Card with ID ${TEST_CARD_ID} not found`);
    }
    console.log(`Found card: ${card.title}, in column: ${card.columnId}`);
    
    // Get the column details
    const column = await storage.getColumnById(card.columnId);
    if (!column) {
      throw new Error(`Column with ID ${card.columnId} not found`);
    }
    console.log(`Found column: ${column.name}`);
    
    if (!column.gptAssigned) {
      throw new Error(`Column ${column.name} does not have GPT assigned`);
    }
    console.log(`Column has GPT assigned: ${column.gptAssigned}`);
    console.log(`GPT Name: ${column.gptName || 'Default'}`);
    
    // Create an image generation request
    const imagePrompt = "Generate an image of a sunset over mountains";
    console.log(`Using image prompt: "${imagePrompt}"`);
    
    // Update the card to mark as not processing first (to ensure clean state)
    await storage.updateCard(TEST_CARD_ID, { processing: false });
    
    // Directly call processChat with the image generation prompt
    console.log('Calling processChat function directly...');
    await processChat(TEST_CARD_ID, imagePrompt, column);
    
    console.log('processChat function returned successfully');
    
    // Wait a moment to ensure any asynchronous operations complete
    console.log('Waiting 5 seconds for any async operations to complete...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if the card is still in processing state
    const updatedCard = await storage.getCardById(TEST_CARD_ID);
    if (!updatedCard) {
      throw new Error(`Failed to get updated card with ID ${TEST_CARD_ID}`);
    }
    console.log(`Card processing state after test: ${updatedCard.processing}`);
    
    // Get recent chats to check for image generation messages
    const chats = await storage.getChatsByCardId(TEST_CARD_ID);
    console.log(`Found ${chats.length} chats for the card`);
    
    // Get the most recent chats (up to 5)
    const recentChats = [...chats]
      .sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).toString() : new Date().toString();
        const timeB = b.timestamp ? new Date(b.timestamp).toString() : new Date().toString();
        return timeB.localeCompare(timeA);
      })
      .slice(0, 5);
    
    console.log('\nMost recent chat messages:');
    recentChats.forEach((chat, i) => {
      const timestamp = chat.timestamp ? new Date(chat.timestamp).toISOString() : new Date().toISOString();
      console.log(`\n[${i+1}] ${chat.role.toUpperCase()} - ${timestamp}`);
      console.log(chat.content.substring(0, 200) + (chat.content.length > 200 ? '...' : ''));
    });
    
    // Look for image generation confirmation messages
    const imageConfirmation = recentChats.find(chat => 
      chat.role === 'assistant' && 
      (chat.content.includes('Generated an image') || 
       chat.content.includes('🎨 Generating an image') ||
       chat.content.includes('/api/attachments/'))
    );
    
    if (imageConfirmation) {
      console.log('\n✅ Found image generation confirmation message:');
      console.log(imageConfirmation.content);
      
      // Try to extract the attachment ID
      const attachmentIdMatch = imageConfirmation.content.match(/\/api\/attachments\/(\d+)/);
      if (attachmentIdMatch && attachmentIdMatch[1]) {
        const attachmentId = parseInt(attachmentIdMatch[1]);
        console.log(`\nFound image attachment ID: ${attachmentId}`);
      }
    } else {
      console.log('\n❌ No image generation confirmation message found');
    }
    
    // Get attachments to check for generated images
    const attachments = await storage.getAttachmentsByCardId(TEST_CARD_ID);
    const imageAttachments = attachments.filter(att => att.fileType?.includes('image') || false);
    
    console.log(`\nFound ${imageAttachments.length} image attachments for the card`);
    
    if (imageAttachments.length > 0) {
      // Display the most recent image attachment
      const latestImage = [...imageAttachments].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).toString() : new Date().toString();
        const timeB = b.createdAt ? new Date(b.createdAt).toString() : new Date().toString();
        return timeB.localeCompare(timeA);
      })[0];
      
      console.log('\nMost recent image attachment:');
      console.log(`ID: ${latestImage.id}`);
      console.log(`Filename: ${latestImage.filename}`);
      console.log(`File Type: ${latestImage.fileType}`);
      console.log(`Created At: ${latestImage.createdAt}`);
      console.log(`Content length: ${latestImage.content.length} characters`);
      
      // Check if this was created during our test
      const attachmentTime = latestImage.createdAt ? new Date(latestImage.createdAt) : new Date();
      const testStartTime = new Date(Date.now() - 20000); // 20 seconds ago
      
      if (attachmentTime > testStartTime) {
        console.log('\n✅ TEST PASSED: Found recently created image attachment!');
      } else {
        console.log('\n⚠️ Found image attachment but it may be from a previous test');
        console.log(`Attachment time: ${attachmentTime.toISOString()}`);
        console.log(`Test start time: ${testStartTime.toISOString()}`);
      }
    } else {
      console.log('\n❌ TEST FAILED: No image attachments found');
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED: Error during test:', error);
  }
}

// Run the test
testImageGeneration();