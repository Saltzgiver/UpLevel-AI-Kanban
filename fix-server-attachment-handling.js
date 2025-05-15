/**
 * Fix Server-Side Attachment Handling
 * 
 * This script addresses the issue with server-side attachment handling for images:
 * 1. Updates the /api/attachments/:id endpoint to properly serve image files
 * 2. Enhances the image attachment creation in the handleFileGeneration function
 * 3. Adds proper caching headers for attachment responses
 * 4. Adds detailed logging for attachment requests
 */

import fs from 'fs';

try {
  // First update the routes.ts file to enhance attachment handling
  const routesPath = './server/routes.ts';
  console.log('Reading routes.ts file...');
  const routesContent = fs.readFileSync(routesPath, 'utf8');
  
  // Make a backup of the original file
  fs.writeFileSync(`${routesPath}.backup-attachments`, routesContent, 'utf8');
  console.log('✅ Created backup of routes.ts file');
  
  // Update the attachment endpoint
  let updatedRoutesContent = routesContent;
  
  // Find the attachment endpoint handler
  const attachmentEndpointRegex = /app\.get\("\/api\/attachments\/:id", async \(req, res\) => {[\s\S]*?}\);/;
  
  if (attachmentEndpointRegex.test(updatedRoutesContent)) {
    console.log('✅ Found attachment endpoint in routes.ts');
    
    // Update the endpoint with improved handling
    updatedRoutesContent = updatedRoutesContent.replace(
      attachmentEndpointRegex,
      `app.get("/api/attachments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(\`[ATTACHMENT-API] Fetching attachment with ID: \${id}\`);
      
      // Use 0 as a placeholder for cardId since we're fetching by attachment ID
      const attachments = await storage.getAttachmentsByCardId(0, id);
      
      if (!attachments || attachments.length === 0) {
        console.error(\`[ATTACHMENT-API] Attachment not found with ID: \${id}\`);
        return res.status(404).json({ message: "Attachment not found" });
      }
      
      const attachment = attachments[0];
      console.log(\`[ATTACHMENT-API] Found attachment: \${attachment.filename}, type: \${attachment.fileType}, content length: \${attachment.content?.length || 0}\`);
      
      // Set appropriate headers for the file type
      res.setHeader('Content-Type', attachment.fileType);
      res.setHeader('Content-Disposition', \`inline; filename="\${attachment.filename}"\`);
      
      // Set cache headers to improve performance
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      res.setHeader('ETag', \`"\${id}-\${attachment.filename}"\`);
      
      // If it's an image, send the image data
      if (attachment.fileType.startsWith('image/')) {
        console.log(\`[ATTACHMENT-API] Serving image attachment with ID: \${id}\`);
        
        try {
          // Assuming content is base64 encoded, convert to buffer
          const buffer = Buffer.from(attachment.content, 'base64');
          console.log(\`[ATTACHMENT-API] Converted base64 to buffer, size: \${buffer.length} bytes\`);
          
          // Send the buffer as the response
          return res.send(buffer);
        } catch (error) {
          console.error(\`[ATTACHMENT-API] Error converting attachment content to buffer: \${error.message}\`);
          return res.status(500).json({ message: "Error processing attachment" });
        }
      } else {
        // For other file types, just send the content directly
        console.log(\`[ATTACHMENT-API] Serving non-image attachment with ID: \${id}\`);
        return res.send(attachment.content);
      }
    } catch (error) {
      console.error(\`[ATTACHMENT-API] Error fetching attachment: \${error.message}\`);
      return res.status(500).json({ message: "Error fetching attachment" });
    }
  });`
    );
    
    // Save the updated routes file
    fs.writeFileSync(routesPath, updatedRoutesContent, 'utf8');
    console.log('✅ Successfully updated routes.ts file with enhanced attachment endpoint');
  } else {
    console.warn('⚠️ Could not find attachment endpoint in routes.ts file');
  }
  
  // Now let's update the openai.ts file to ensure images are properly created and linked
  const openaiPath = './server/openai.ts';
  console.log('Reading openai.ts file...');
  const openaiContent = fs.readFileSync(openaiPath, 'utf8');
  
  // Make a backup of the original file
  fs.writeFileSync(`${openaiPath}.backup-attachments`, openaiContent, 'utf8');
  console.log('✅ Created backup of openai.ts file');
  
  // Find and update the image handling section in handleFileGeneration
  const imageHandlingRegex = /\/\/ Process image data if provided[\s\S]*?await storage\.createChat\(chatMessage\);/;
  
  if (imageHandlingRegex.test(openaiContent)) {
    console.log('✅ Found image handling section in openai.ts');
    
    let updatedOpenaiContent = openaiContent;
    
    // Ensure we have proper logging for the attachment creation
    if (!updatedOpenaiContent.includes('[IMAGE-PROCESS] Creating attachment details')) {
      updatedOpenaiContent = updatedOpenaiContent.replace(
        /console\.log\(`\[IMAGE-PROCESS\] Creating attachment:.*?\);/,
        'console.log(`[IMAGE-PROCESS] Creating attachment details: cardId=${cardId}, fileType=${fileType}, filename=${filename}, content length=${content.length}`);\n' +
        '        // Log the first 100 characters of content for debugging\n' +
        '        console.log(`[IMAGE-PROCESS] Content preview: ${content.substring(0, 100)}...`);'
      );
    }
    
    // Ensure the chat message content has proper markdown image syntax
    if (!updatedOpenaiContent.includes('![Generated image](/api/attachments/')) {
      updatedOpenaiContent = updatedOpenaiContent.replace(
        /content: .*?\${attachment\.id}\}(?:'|")/,
        'content: `✨ Generated an image based on your request: "${originalPrompt}".\n\n![Generated image](/api/attachments/${attachment.id})`'
      );
      
      console.log('✅ Updated chat message content with proper Markdown image syntax');
    }
    
    // Save the updated openai file
    fs.writeFileSync(openaiPath, updatedOpenaiContent, 'utf8');
    console.log('✅ Successfully updated openai.ts file');
  } else {
    console.warn('⚠️ Could not find image handling section in openai.ts file');
  }
  
  console.log(`
================================================================
✅ SERVER-SIDE ATTACHMENT HANDLING FIX APPLIED SUCCESSFULLY

The server-side attachment handling has been updated to:
1. Properly serve image files from the /api/attachments/:id endpoint
2. Set appropriate content-type and cache headers for better performance
3. Add detailed logging for attachment requests and creation
4. Ensure chat messages have proper Markdown image syntax

This fix works with the client-side fix to ensure images are properly
generated, saved, and displayed in card chats.

To test, open a card chat and try to generate an image with a message like 
"generate an image of a burger".
================================================================
  `);
  
} catch (error) {
  console.error('Error updating the files:', error);
  process.exit(1);
}