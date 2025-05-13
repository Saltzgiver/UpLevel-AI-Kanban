/**
 * Direct test script for image generation with DALL-E 3 fallback
 * 
 * This script tests the image generation by directly connecting to the API
 * and executing an image generation request.
 */

import fetch from 'node-fetch';

const PORT = process.env.PORT || 5000;
const HOST = process.env.PORT ? '0.0.0.0' : 'localhost';
const BASE_URL = `http://${HOST}:${PORT}`;

async function makeAPIRequest(endpoint, method = 'GET', body = undefined) {
  const url = `${BASE_URL}${endpoint}`;
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  console.log(`[API] Making ${method} request to ${url}`);
  if (body) {
    console.log(`[API] Request body: ${JSON.stringify(body, null, 2)}`);
  }
  
  const response = await fetch(url, options);
  const responseText = await response.text();
  
  try {
    const data = JSON.parse(responseText);
    return { status: response.status, data };
  } catch (error) {
    console.log(`Response is not JSON. Status: ${response.status}, Text: ${responseText.substring(0, 300)}...`);
    return { status: response.status, text: responseText };
  }
}

/**
 * Create a chat message requesting image generation
 * Uses the GPT chat endpoint directly
 */
async function testImageGenerationDirect() {
  try {
    console.log("Starting direct image generation test with fallback to DALL-E 3...");
    
    // Create a card for testing if it doesn't exist
    const cardId = 101;
    
    // Get column information
    const { data: columns } = await makeAPIRequest('/api/columns');
    console.log(`Found ${columns.length} columns`);
    
    const gptColumn = columns.find(col => col.gptEnabled);
    if (!gptColumn) {
      console.error("No GPT-enabled column found. Please create one first.");
      return;
    }
    
    console.log(`Using column ${gptColumn.id} (${gptColumn.name}) with GPT enabled`);
    
    // Create a chat message requesting an image
    const imagePrompt = "Create an image of a serene mountain landscape with a waterfall and rainbow";
    const chatBody = {
      content: imagePrompt,
      cardId,
      columnId: gptColumn.id
    };
    
    console.log(`Creating chat message for card ${cardId} with prompt: ${imagePrompt}`);
    const chatResult = await makeAPIRequest('/api/chats', 'POST', chatBody);
    
    if (chatResult.status !== 201) {
      console.error(`Failed to create chat message: ${JSON.stringify(chatResult, null, 2)}`);
      return;
    }
    
    console.log("Chat message created successfully, will trigger GPT processing");
    
    // Wait for processing to complete
    let processingComplete = false;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (!processingComplete && attempts < maxAttempts) {
      attempts++;
      
      // Wait a bit between checks
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log(`Checking processing status (attempt ${attempts}/${maxAttempts})...`);
      const statusResult = await makeAPIRequest(`/api/cards/${cardId}/processing-status`);
      
      if (statusResult.status === 200) {
        const { processing } = statusResult.data;
        processingComplete = !processing;
        
        if (processingComplete) {
          console.log("Processing complete!");
        } else {
          console.log("Still processing...");
        }
      } else {
        console.error(`Failed to check processing status: ${JSON.stringify(statusResult, null, 2)}`);
      }
    }
    
    if (attempts >= maxAttempts) {
      console.error("Reached maximum attempts waiting for processing to complete");
      return;
    }
    
    // Get recent chats to see the response
    const chatsResult = await makeAPIRequest(`/api/cards/${cardId}/chats`);
    
    if (chatsResult.status === 200) {
      const recentChats = chatsResult.data;
      console.log(`Found ${recentChats.length} chats for card ${cardId}`);
      
      // Get most recent assistant message
      const assistantChats = recentChats.filter(chat => chat.role === 'assistant');
      if (assistantChats.length > 0) {
        const latestChat = assistantChats[assistantChats.length - 1];
        console.log("Latest assistant message:");
        console.log("-".repeat(50));
        console.log(latestChat.content);
        console.log("-".repeat(50));
      }
    } else {
      console.error(`Failed to get chats: ${JSON.stringify(chatsResult, null, 2)}`);
    }
    
    // Get attachments to see if an image was generated
    const attachmentsResult = await makeAPIRequest(`/api/cards/${cardId}/attachments`);
    
    if (attachmentsResult.status === 200) {
      const attachments = attachmentsResult.data;
      console.log(`Found ${attachments.length} attachments for card ${cardId}`);
      
      // Find the most recent image attachment
      const imageAttachments = attachments.filter(att => att.fileType.startsWith('image/'));
      
      if (imageAttachments.length > 0) {
        // Sort by ID (assuming higher ID = more recent)
        imageAttachments.sort((a, b) => b.id - a.id);
        
        const latestImage = imageAttachments[0];
        console.log("Latest image attachment:");
        console.log(`- ID: ${latestImage.id}`);
        console.log(`- Filename: ${latestImage.filename}`);
        console.log(`- File type: ${latestImage.fileType}`);
        console.log(`- Created at: ${new Date(latestImage.createdAt).toLocaleString()}`);
        console.log(`- URL: ${BASE_URL}/uploads/${latestImage.filename}`);
        
        // Log success
        console.log("\nSUCCESS: Image was generated successfully! ✅");
      } else {
        console.error("No image attachments found");
      }
    } else {
      console.error(`Failed to get attachments: ${JSON.stringify(attachmentsResult, null, 2)}`);
    }
    
  } catch (error) {
    console.error("Error during test:", error);
  }
}

// Run the test
testImageGenerationDirect().catch(console.error);