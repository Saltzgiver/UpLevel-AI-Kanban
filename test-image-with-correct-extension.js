/**
 * Test script for image generation with improved file extension handling
 * 
 * This script tests that images are now generated with the correct file extension
 * and MIME type instead of being incorrectly saved as CSV files.
 */

import fetch from 'node-fetch';

// Fetch API helper function with proper error handling
async function makeRequest(endpoint, method = 'GET', body = undefined) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`http://localhost:5000${endpoint}`, options);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error making ${method} request to ${endpoint}:`, error.message);
    throw error;
  }
}

// Delay helper
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test image generation with the corrected file extension logic
async function testImageGenerationWithCorrectExtension() {
  console.log('=== TESTING IMAGE GENERATION WITH CORRECTED FILE EXTENSION HANDLING ===');
  
  // Test card ID with an existing GPT column
  const cardId = 122; // Use a card that exists in your database
  console.log(`Using card ID: ${cardId}`);
  
  // Image prompt
  const prompt = "Generate an image of a delicious hamburger with fries";
  console.log(`Test prompt: "${prompt}"`);
  
  // Step 1: Create a chat message requesting an image
  console.log('\nStep 1: Creating chat message...');
  try {
    const chatResult = await makeRequest(`/api/cards/${cardId}/chats`, 'POST', {
      content: prompt,
      role: 'user'
    });
    
    console.log(`Chat message created with ID: ${chatResult.id}`);
  } catch (error) {
    console.error('Failed to create chat message:', error);
    return;
  }
  
  // Step 2: Allow time for processing
  console.log('\nStep 2: Waiting for processing...');
  
  let processingCompleted = false;
  let attempts = 0;
  const maxAttempts = 30; // 30 second timeout
  
  while (!processingCompleted && attempts < maxAttempts) {
    attempts++;
    console.log(`Checking processing status (attempt ${attempts}/${maxAttempts})...`);
    
    try {
      const statusResult = await makeRequest(`/api/cards/${cardId}/processing-status`);
      if (!statusResult.processing) {
        console.log('Processing completed!');
        processingCompleted = true;
        break;
      }
    } catch (error) {
      console.error('Error checking processing status:', error);
    }
    
    await delay(1000); // Wait 1 second between checks
  }
  
  if (!processingCompleted) {
    console.log('❌ Processing timed out after 30 seconds');
    return;
  }
  
  // Step 3: Check for attachments
  console.log('\nStep 3: Checking for image attachments...');
  
  try {
    // Get the card details which includes attachments
    const card = await makeRequest(`/api/cards/${cardId}`);
    
    if (!card.attachments || card.attachments.length === 0) {
      console.log('❌ No attachments found on the card');
      return;
    }
    
    console.log(`Found ${card.attachments.length} attachments on the card`);
    
    // Get the most recent attachment
    const latestAttachment = card.attachments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    
    console.log('\nLatest attachment details:');
    console.log(`ID: ${latestAttachment.id}`);
    console.log(`Filename: ${latestAttachment.filename}`);
    console.log(`File type: ${latestAttachment.fileType}`);
    console.log(`Created at: ${latestAttachment.createdAt}`);
    
    // Check if it's an image and not a CSV
    const isImage = latestAttachment.fileType.startsWith('image/');
    const isCSV = latestAttachment.fileType === 'text/csv' || latestAttachment.filename.endsWith('.csv');
    
    if (isImage && !isCSV) {
      console.log('\n✅ SUCCESS: The attachment is correctly saved as an image!');
      console.log(`Image filename: ${latestAttachment.filename}`);
      console.log(`Image MIME type: ${latestAttachment.fileType}`);
    } else if (isCSV) {
      console.log('\n❌ ISSUE: The attachment is still being saved as a CSV file');
      console.log(`Filename: ${latestAttachment.filename}`);
      console.log(`File type: ${latestAttachment.fileType}`);
    } else {
      console.log('\n❓ UNEXPECTED: The attachment is neither an image nor a CSV file');
      console.log(`Filename: ${latestAttachment.filename}`);
      console.log(`File type: ${latestAttachment.fileType}`);
    }
    
  } catch (error) {
    console.error('Error checking for attachments:', error);
    return;
  }
}

// Run the test
testImageGenerationWithCorrectExtension().catch(error => {
  console.error('Test failed with error:', error);
});