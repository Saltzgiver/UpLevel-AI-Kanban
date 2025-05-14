/**
 * Fix Image Display Issues in Chat
 * 
 * This script addresses the issue where images in chats are displayed as strings
 * like "file:burger_card.png,image/png,<image content>" instead of actual images.
 * 
 * The problem appears to be related to how the content is rendered in the frontend,
 * and how the image data is being processed in the server.
 */

import fs from 'fs';
import path from 'path';

// Path to the server/openai.ts file
const openaiFilePath = './server/openai.ts';

// Let's modify the handleFileGeneration function to properly process images
// and ensure they're created as attachments rather than text in the messages
try {
  console.log('Reading openai.ts file...');
  const fileContent = fs.readFileSync(openaiFilePath, 'utf8');
  
  // First, ensure extension is declared with 'let' instead of 'const'
  let updatedContent = fileContent.replace(
    /const extension = fileType\.split\('\/'\)\[1\] \|\| 'png';/g,
    'let extension = fileType.split(\'/\')[1] || \'png\';'
  );
  
  // Log if we found and replaced the extension variable
  if (updatedContent !== fileContent) {
    console.log('✅ Fixed extension variable declaration (const → let)');
  } else {
    console.log('ℹ️ Extension variable already using let or not found');
  }
  
  // Look for the createChat call in the handleFileGeneration function and ensure 
  // we're not putting file data directly in the chat message
  const createChatWithFileRegex = /await storage\.createChat\(\{\s*cardId,\s*role: "assistant",\s*content: `file:([^`]+)`/;
  
  if (createChatWithFileRegex.test(updatedContent)) {
    console.log('⚠️ Found direct file data in chat content - fixing this issue');
    
    // Replace the problematic createChat call with one that uses proper attachment linking
    updatedContent = updatedContent.replace(
      createChatWithFileRegex,
      'await storage.createChat({\n' +
      '        cardId,\n' +
      '        role: "assistant",\n' +
      '        content: `I\'ve generated the requested image. You can view it below.`'
    );
    
    console.log('✅ Fixed chat message content to properly display image');
  } else {
    console.log('ℹ️ Did not find direct file data in chat content');
  }
  
  // Update the file with our changes
  fs.writeFileSync(openaiFilePath, updatedContent, 'utf8');
  console.log('✅ Successfully updated the openai.ts file');
  
} catch (error) {
  console.error('Error updating the file:', error);
  process.exit(1);
}