/**
 * Direct Fix for Image Generation Display in Chat
 * 
 * This script provides a targeted fix for the image display issue in chat messages
 * by directly updating the handleFileGeneration function to correctly format image
 * messages as Markdown, matching the approach used in the test scripts.
 */

import fs from 'fs';
import path from 'path';

// Path to the openai.ts file
const openaiFilePath = './server/openai.ts';

try {
  console.log('Reading openai.ts file...');
  const fileContent = fs.readFileSync(openaiFilePath, 'utf8');
  
  // Make a backup of the original file
  fs.writeFileSync(`${openaiFilePath}.backup-${Date.now()}`, fileContent, 'utf8');
  console.log('✅ Created backup of openai.ts file');
  
  // Look for the content assignment in the chat message
  const chatMessageContentRegex = /(content: `.*?file:.*?\.png,.*?,.*?`)/;
  
  if (chatMessageContentRegex.test(fileContent)) {
    console.log('⚠️ Found problematic chat message content format. Fixing...');
    
    // Replace all occurrences of direct file content with markdown image syntax
    const updatedContent = fileContent.replace(
      /(content: `)file:([^,]+),([^,]+),(.*?)(`)/g,
      'content: `✨ Generated an image for you.\n\n![Generated image](/api/attachments/${attachment.id})`'
    );
    
    // Make sure the content message is correctly formatted with the image URL
    const finalContent = updatedContent.replace(
      /(cardId,\s*role: "assistant",\s*content:.*?)(\s*})/g,
      '$1\n    content: `✨ Generated an image based on your request.\n\n![Generated image](/api/attachments/${attachment.id})`$2'
    );
    
    // Write the updated content back to the file
    fs.writeFileSync(openaiFilePath, finalContent, 'utf8');
    console.log('✅ Successfully fixed chat message content format');
  } else {
    console.log('🔍 Did not find problematic chat message content format. Checking the whole file structure...');
    
    // Look for the entire chat message creation block
    const chatCreationBlock = fileContent.match(/const chatMessage:[\s\S]*?await storage\.createChat\(chatMessage\);/);
    
    if (chatCreationBlock) {
      console.log('✅ Found chat message creation block. Ensuring it uses the correct format...');
      
      // Replace the entire content setting line to ensure correct formatting
      const updatedContent = fileContent.replace(
        /(content: `).*?(`[\s\S]*?await storage\.createChat\(chatMessage\);)/s,
        'content: `✨ Generated an image based on your request.\n\n![Generated image](/api/attachments/${attachment.id})`$2'
      );
      
      // Write the updated content back to the file
      fs.writeFileSync(openaiFilePath, updatedContent, 'utf8');
      console.log('✅ Successfully updated chat message content format');
    } else {
      console.log('⚠️ Could not locate the chat message creation block. Will try a more direct approach...');
      
      // Find the handleFileGeneration function
      const handleFileGenerationRegex = /export async function handleFileGeneration[\s\S]*?}/;
      const handleFileGenerationMatch = fileContent.match(handleFileGenerationRegex);
      
      if (handleFileGenerationMatch) {
        console.log('✅ Found handleFileGeneration function. Applying targeted fix...');
        
        // Get the function content
        const funcContent = handleFileGenerationMatch[0];
        
        // Create a new function with the correct image message format
        const fixedFuncContent = funcContent.replace(
          /(content: .*?)(\s*}[\s\S]*?await storage\.createChat\(chatMessage\);)/s,
          'content: `✨ Generated an image based on your request.\n\n![Generated image](/api/attachments/${attachment.id})`$2'
        );
        
        // Replace the old function with the fixed one
        const updatedContent = fileContent.replace(handleFileGenerationRegex, fixedFuncContent);
        
        // Write the updated content back to the file
        fs.writeFileSync(openaiFilePath, updatedContent, 'utf8');
        console.log('✅ Successfully applied targeted fix to handleFileGeneration function');
      } else {
        console.log('❌ Could not locate the handleFileGeneration function. Manual intervention required.');
        process.exit(1);
      }
    }
  }
  
  console.log(`
================================================================
✅ FIX APPLIED SUCCESSFULLY

The image generation function has been updated to correctly format
image messages in chats as Markdown with the format:

![Generated image](/api/attachments/{id})

This will ensure that images are displayed properly in card chats
instead of appearing as text strings like "file:image.png,mime/type,data".

To test, try sending a message like "generate an image of a burger" in a card chat.
================================================================
  `);
  
} catch (error) {
  console.error('Error updating the file:', error);
  process.exit(1);
}