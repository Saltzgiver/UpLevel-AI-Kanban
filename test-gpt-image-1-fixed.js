// Test script for the new gpt-image-1 image generation model (fixed version)
import fetch from 'node-fetch';

// Use a card ID that exists
const CARD_ID = 101;
const TEST_PROMPT = "Create an image of a serene mountain landscape with a waterfall and rainbow";

async function testImageGeneration() {
  try {
    console.log("Starting image generation test with the fixed gpt-image-1 model...");
    
    // Create a chat message first
    console.log(`Creating chat message for card ${CARD_ID} with prompt: ${TEST_PROMPT}`);
    
    const chatResponse = await fetch(`http://localhost:5000/api/cards/${CARD_ID}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: TEST_PROMPT
      })
    });
    
    if (!chatResponse.ok) {
      throw new Error(`Failed to create chat: ${chatResponse.status}`);
    }
    
    console.log("Chat created successfully");
    
    // Trigger processing
    console.log(`Triggering image generation processing for card ${CARD_ID}...`);
    const triggerResponse = await fetch(`http://localhost:5000/api/cards/${CARD_ID}/trigger-gpt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!triggerResponse.ok) {
      throw new Error(`Failed to trigger processing: ${triggerResponse.status}`);
    }
    
    console.log("Processing triggered successfully, now waiting for the image generation to complete");
    
    // Check status in a loop
    let isProcessing = true;
    let attempt = 0;
    const maxAttempts = 30;
    
    while (isProcessing && attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempt++;
      
      const statusResponse = await fetch(`http://localhost:5000/api/cards/${CARD_ID}/processing-status`);
      if (!statusResponse.ok) {
        throw new Error(`Failed to check status: ${statusResponse.status}`);
      }
      
      const status = await statusResponse.json();
      isProcessing = status.processing;
      console.log(`Checking status (attempt ${attempt}/${maxAttempts}): processing=${isProcessing}`);
      
      if (!isProcessing) {
        // Get the attachments to confirm the image was created
        const attachments = await fetch(`http://localhost:5000/api/cards/${CARD_ID}/attachments`);
        const attachmentData = await attachments.json();
        
        // Check if we have a new image attachment
        console.log(`Found ${attachmentData.length} attachments for card ${CARD_ID}:`);
        attachmentData.forEach((att, i) => {
          console.log(`  [${i+1}] ${att.filename} (${att.fileType}) - ID: ${att.id}`);
        });
        
        // Check the last chat message to verify it includes an image reference
        const chats = status.chats || [];
        if (chats.length > 0) {
          const lastChat = chats[chats.length - 1];
          console.log(`Last chat message (${lastChat.role}):`);
          console.log(`"${lastChat.content.substring(0, 150)}${lastChat.content.length > 150 ? '...' : ''}"`);
          
          // Check if there's an image markdown link
          const imageMarkdown = /!\[.*?\]\((.*?)\)/;
          const match = lastChat.content.match(imageMarkdown);
          if (match) {
            console.log(`✅ SUCCESS: Found image reference in chat: ${match[1]}`);
          } else {
            console.log(`❌ ERROR: No image reference found in the chat message`);
          }
        }
      }
    }
    
    if (isProcessing) {
      console.log("❌ Timed out waiting for processing to complete");
    } else {
      console.log("✅ Processing completed successfully");
    }
    
  } catch (error) {
    console.error("Error during test:", error);
  }
}

testImageGeneration();