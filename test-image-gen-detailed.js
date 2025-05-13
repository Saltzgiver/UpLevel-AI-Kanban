/**
 * Detailed testing script for image generation with gpt-image-1
 * 
 * This script creates a test chat message requesting an image generation,
 * triggers the processing, and monitors the logs to diagnose any issues
 * with the image display.
 */

const { Pool } = require('pg');
const fetch = require('node-fetch');

// Test configuration
const CARD_ID = 120; // Use a test card that doesn't have many chats
const TEST_PROMPT = "Generate a detailed image of a tropical beach with palm trees, crystal clear water, and a small boat";

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Create a chat message with an image generation prompt
 */
async function createChatMessage(cardId, content) {
  console.log(`Creating chat message for card ${cardId} with prompt: ${content}`);
  
  try {
    const response = await fetch(`http://localhost:5000/api/cards/${cardId}/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'user',
        content,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create chat: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`Chat created:`, result);
    return result;
  } catch (error) {
    console.error(`Error creating chat message:`, error);
    throw error;
  }
}

/**
 * Trigger GPT processing for the card
 */
async function triggerProcessing(cardId) {
  console.log(`Triggering image generation processing for card ${cardId}...`);
  
  try {
    // First update the card to set processing=true
    const updateResponse = await fetch(`http://localhost:5000/api/cards/${cardId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        processing: true,
      }),
    });
    
    if (!updateResponse.ok) {
      throw new Error(`Failed to update card: ${updateResponse.status}`);
    }
    
    // Trigger the processing endpoint
    const response = await fetch(`http://localhost:5000/api/cards/${cardId}/process-image-gen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to trigger processing: ${response.status} ${response.statusText}`);
    }
    
    console.log(`Processing triggered successfully, now waiting for the image generation to complete`);
    return true;
  } catch (error) {
    console.error(`Error triggering processing:`, error);
    throw error;
  }
}

/**
 * Check if the card is still processing
 */
async function checkProcessingStatus(cardId) {
  try {
    const response = await fetch(`http://localhost:5000/api/cards/${cardId}/processing-status`);
    
    if (!response.ok) {
      throw new Error(`Failed to get processing status: ${response.status}`);
    }
    
    const status = await response.json();
    return status.processing;
  } catch (error) {
    console.error(`Error checking processing status:`, error);
    return true; // Assume still processing if there's an error
  }
}

/**
 * Get the most recent chat messages
 */
async function getRecentChats(cardId, limit = 5) {
  try {
    const response = await fetch(`http://localhost:5000/api/cards/${cardId}/chats`);
    
    if (!response.ok) {
      throw new Error(`Failed to get chats: ${response.status}`);
    }
    
    const chats = await response.json();
    return chats.slice(-limit); // Return the most recent chats
  } catch (error) {
    console.error(`Error getting recent chats:`, error);
    return [];
  }
}

/**
 * Get recent attachments for the card
 */
async function getAttachments(cardId) {
  try {
    const response = await fetch(`http://localhost:5000/api/cards/${cardId}/attachments`);
    
    if (!response.ok) {
      throw new Error(`Failed to get attachments: ${response.status}`);
    }
    
    const attachments = await response.json();
    return attachments;
  } catch (error) {
    console.error(`Error getting attachments:`, error);
    return [];
  }
}

/**
 * Main test function
 */
async function testImageGeneration() {
  console.log("Starting detailed image generation test with the newest gpt-image-1 model...");
  
  try {
    // Step 1: Create a test message requesting an image
    await createChatMessage(CARD_ID, TEST_PROMPT);
    
    // Step 2: Trigger processing
    await triggerProcessing(CARD_ID);
    
    // Step 3: Wait for processing to complete
    let isProcessing = true;
    let attempt = 0;
    const maxAttempts = 30; // Maximum number of attempts (5 minutes total)
    
    while (isProcessing && attempt < maxAttempts) {
      attempt++;
      isProcessing = await checkProcessingStatus(CARD_ID);
      console.log(`Checking status (attempt ${attempt}/${maxAttempts}): processing=${isProcessing}`);
      
      if (isProcessing) {
        // Wait 10 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
    
    console.log("\nProcessing completed!");
    
    // Step 4: Get the final chats and analyze the results
    const finalChats = await getRecentChats(CARD_ID);
    console.log("\nFinal chat messages:");
    finalChats.forEach(chat => {
      console.log(`[${chat.role}] ${chat.content.substring(0, 100)}${chat.content.length > 100 ? '...' : ''}`);
    });
    
    // Step 5: Check for generated attachments
    const attachments = await getAttachments(CARD_ID);
    console.log("\nGenerated attachments:");
    attachments.forEach(attachment => {
      console.log(`- ID: ${attachment.id}, Filename: ${attachment.filename}, Type: ${attachment.fileType}`);
    });
    
    // Step 6: Analyze if the image URL appears properly in the assistant message
    const assistantMessages = finalChats.filter(chat => chat.role === 'assistant');
    if (assistantMessages.length > 0) {
      const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
      
      // Look for image markdown format: ![alt text](url)
      const imageMarkdownRegex = /!\[.*?\]\((.*?)\)/;
      const match = lastAssistantMessage.content.match(imageMarkdownRegex);
      
      if (match && match[1]) {
        console.log("\nFound image URL in assistant message:", match[1]);
        
        // Check if the URL matches one of our attachments
        const attachmentIds = attachments.map(a => a.id);
        const urlContainsAttachmentId = attachmentIds.some(id => match[1].includes(id.toString()));
        
        if (urlContainsAttachmentId) {
          console.log("✅ Success! Image URL correctly references an attachment");
        } else {
          console.log("❌ Error: Image URL does not reference any known attachment");
        }
      } else {
        console.log("❌ Error: No image URL found in the assistant message");
      }
    } else {
      console.log("❌ Error: No assistant messages found");
    }
    
    console.log("\nTest completed!");
  } catch (error) {
    console.error("Test failed with error:", error);
  } finally {
    // Always close the pool when done
    await pool.end();
  }
}

// Run the test
testImageGeneration();