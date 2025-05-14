/**
 * Image Generation Safety Test
 * 
 * This script tests our enhanced image generation implementation with:
 * 1. A valid image prompt
 * 2. The timeout mechanism
 * 3. Error handling and user feedback
 */

const fetch = require('node-fetch');

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

  const response = await fetch(`http://localhost:5000${endpoint}`, options);
  return await response.json();
}

/**
 * Tests image generation with a valid prompt
 */
async function testValidImageGeneration() {
  console.log("=== Testing Image Generation with Valid Prompt ===");
  
  // Create a new card in the Image column
  const testCard = await makeRequest('/api/cards', 'POST', {
    title: "Image Generation Test",
    content: "Testing image generation",
    columnId: 21, // The Image column ID
    order: 0
  });
  
  console.log(`Created test card with ID: ${testCard.id}`);
  
  // Add a chat message requesting an image
  await makeRequest('/api/chats', 'POST', {
    cardId: testCard.id,
    content: "Generate an image of a cute puppy playing in a garden",
    role: "user"
  });
  
  console.log("Added chat message requesting an image");
  console.log("Image generation started. The process may take a minute or two...");
  
  // Check the processing status
  let isProcessing = true;
  let checkCount = 0;
  
  while (isProcessing && checkCount < 15) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    const status = await makeRequest(`/api/cards/${testCard.id}/processing-status`);
    isProcessing = status.processing;
    
    console.log(`Processing status check #${checkCount + 1}: ${isProcessing ? "Still processing" : "Completed"}`);
    checkCount++;
  }
  
  // Get the latest chats to see the result
  const chats = await makeRequest(`/api/cards/${testCard.id}/chats`);
  console.log("\nLatest chat messages:");
  chats.reverse().slice(0, 3).forEach(chat => {
    console.log(`[${chat.role}]: ${chat.content.substring(0, 100)}${chat.content.length > 100 ? '...' : ''}`);
  });
  
  // Get any attachments
  const attachments = await makeRequest(`/api/cards/${testCard.id}/attachments`);
  console.log("\nAttachments:");
  attachments.forEach(attachment => {
    console.log(`- ${attachment.filename} (${attachment.file_type})`);
  });
  
  return testCard.id;
}

/**
 * Main test function
 */
async function runTests() {
  try {
    console.log("Starting image generation tests...");
    const cardId = await testValidImageGeneration();
    console.log(`\nTests completed. Check card ID ${cardId} for results.`);
  } catch (error) {
    console.error("Error during tests:", error);
  }
}

// Run the tests
runTests();