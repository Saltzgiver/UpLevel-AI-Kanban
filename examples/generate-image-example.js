/**
 * Example script demonstrating how to use the image generation feature
 * 
 * This script shows how to:
 * 1. Create a card in a GPT-enabled column
 * 2. Add a chat message requesting an image
 * 3. Process the request and get the generated image
 */

import fetch from 'node-fetch';

// Configuration
const API_URL = 'http://localhost:5000';
const IMAGE_PROMPT = 'Create an image of a serene mountain landscape with a waterfall and rainbow';

/**
 * Make an API request with appropriate error handling
 */
async function makeRequest(endpoint, method = 'GET', body = undefined) {
  const url = `${API_URL}${endpoint}`;
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  console.log(`[API] ${method} ${url}`);
  if (body) {
    console.log(`Request body: ${JSON.stringify(body, null, 2)}`);
  }
  
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error making API request: ${error.message}`);
    throw error;
  }
}

/**
 * Get all boards
 */
async function getBoards() {
  return makeRequest('/api/boards');
}

/**
 * Get all columns for a board
 */
async function getColumns(boardId) {
  return makeRequest(`/api/boards/${boardId}/columns`);
}

/**
 * Create a new card in a column
 */
async function createCard(columnId, title, description) {
  return makeRequest('/api/cards', 'POST', {
    columnId,
    title,
    description,
  });
}

/**
 * Create a chat message for a card
 */
async function createChatMessage(cardId, content) {
  return makeRequest('/api/chats', 'POST', {
    cardId,
    content,
    role: 'user',
  });
}

/**
 * Trigger GPT processing for a card
 */
async function triggerProcessing(cardId, message) {
  return makeRequest(`/api/cards/${cardId}/process-chat`, 'POST', {
    message,
  });
}

/**
 * Check if a card is still being processed
 */
async function checkProcessingStatus(cardId) {
  return makeRequest(`/api/cards/${cardId}/processing-status`);
}

/**
 * Get attachments for a card
 */
async function getAttachments(cardId) {
  return makeRequest(`/api/cards/${cardId}/attachments`);
}

/**
 * Wait for processing to complete
 */
async function waitForProcessingToComplete(cardId, maxAttempts = 30, delayMs = 2000) {
  console.log(`Waiting for processing to complete for card ${cardId}...`);
  
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    attempts++;
    
    const status = await checkProcessingStatus(cardId);
    console.log(`Check ${attempts}/${maxAttempts}: Processing=${status.processing}`);
    
    if (!status.processing) {
      console.log('Processing complete!');
      return true;
    }
    
    // Wait before checking again
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  console.log(`Timed out after ${maxAttempts} attempts`);
  return false;
}

/**
 * Run the full image generation example
 */
async function runImageGenerationExample() {
  try {
    console.log('Starting image generation example...');
    
    // Step 1: Get a board
    const boards = await getBoards();
    if (boards.length === 0) {
      throw new Error('No boards found');
    }
    
    const board = boards[0]; // Use the first board
    console.log(`Using board: ${board.name} (ID: ${board.id})`);
    
    // Step 2: Get GPT-enabled columns
    const columns = await getColumns(board.id);
    const gptColumn = columns.find(col => col.gptEnabled);
    
    if (!gptColumn) {
      throw new Error('No GPT-enabled column found. Please create one first.');
    }
    
    console.log(`Using GPT-enabled column: ${gptColumn.name} (ID: ${gptColumn.id})`);
    
    // Step 3: Create a new card
    const cardTitle = 'Image Generation Example';
    const cardDescription = 'This card demonstrates the image generation feature';
    
    console.log(`Creating card "${cardTitle}" in column ${gptColumn.id}...`);
    const card = await createCard(gptColumn.id, cardTitle, cardDescription);
    console.log(`Card created with ID: ${card.id}`);
    
    // Step 4: Create a chat message requesting an image
    console.log(`Creating chat message with prompt: "${IMAGE_PROMPT}"`);
    await createChatMessage(card.id, IMAGE_PROMPT);
    
    // Step 5: Trigger processing
    console.log('Triggering GPT processing...');
    await triggerProcessing(card.id, IMAGE_PROMPT);
    
    // Step 6: Wait for processing to complete
    const processingComplete = await waitForProcessingToComplete(card.id);
    
    if (!processingComplete) {
      throw new Error('Processing timed out');
    }
    
    // Step 7: Get attachments to see the generated image
    const attachments = await getAttachments(card.id);
    const imageAttachments = attachments.filter(a => a.fileType.startsWith('image/'));
    
    if (imageAttachments.length === 0) {
      console.log('No image attachments found. Check for errors in the processing.');
    } else {
      // Find the latest image attachment
      const latestImage = imageAttachments.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })[0];
      
      console.log('\n===== IMAGE GENERATION SUCCESSFUL =====');
      console.log(`Image attachment ID: ${latestImage.id}`);
      console.log(`Filename: ${latestImage.filename}`);
      console.log(`Type: ${latestImage.fileType}`);
      console.log(`URL: ${API_URL}/uploads/${latestImage.filename}`);
    }
    
    console.log('\nExample complete!');
    
  } catch (error) {
    console.error('Example failed:', error.message);
  }
}

// Run the example
runImageGenerationExample().catch(console.error);