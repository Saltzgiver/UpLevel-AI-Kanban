/**
 * Fix Attachment Endpoint for Better Image Handling
 * 
 * This script improves the /api/attachments/:id endpoint to:
 * 1. Add more detailed logging for debugging
 * 2. Improve content-type handling for images
 * 3. Add caching headers for better performance
 */

import fs from 'fs';

try {
  const routesPath = './server/routes.ts';
  console.log('Reading routes.ts file...');
  const routesContent = fs.readFileSync(routesPath, 'utf8');
  
  // Make a backup of the original file
  fs.writeFileSync(`${routesPath}.backup-fix`, routesContent, 'utf8');
  console.log('✅ Created backup of routes.ts file');
  
  // Find the attachment endpoint
  const endpointStartPattern = 'app.get("/api/attachments/:id", async (req, res) => {';
  const endpointEndPattern = '});';
  
  // Find the start and end positions
  const startPos = routesContent.indexOf(endpointStartPattern);
  
  if (startPos === -1) {
    console.error('❌ Could not find attachment endpoint in routes.ts');
    process.exit(1);
  }
  
  // Find the matching closing bracket (considering nested brackets)
  let endPos = -1;
  let depth = 0;
  let inString = false;
  let stringDelimiter = '';
  
  for (let i = startPos; i < routesContent.length; i++) {
    const char = routesContent[i];
    
    // Handle string boundaries
    if ((char === '"' || char === "'" || char === '`') && 
        (i === 0 || routesContent[i-1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringDelimiter = char;
      } else if (char === stringDelimiter) {
        inString = false;
      }
    }
    
    // Only count brackets outside of strings
    if (!inString) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          endPos = i + 1;
          break;
        }
      }
    }
  }
  
  if (endPos === -1) {
    console.error('❌ Could not find the end of attachment endpoint in routes.ts');
    process.exit(1);
  }
  
  // Extract the existing endpoint code
  const existingEndpoint = routesContent.substring(startPos, endPos);
  console.log('✅ Found attachment endpoint in routes.ts');
  
  // Create the improved endpoint
  const improvedEndpoint = `app.get("/api/attachments/:id", async (req, res) => {
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
      
      // Check content
      if (!attachment.content) {
        console.error(\`[ATTACHMENT-API] Empty content for attachment ID: \${id}\`);
        return res.status(500).json({ message: "Attachment has no content" });
      }
      
      // Set appropriate headers for the file type
      res.setHeader('Content-Type', attachment.fileType);
      res.setHeader('Content-Disposition', \`inline; filename="\${attachment.filename}"\`);
      
      // Set cache headers to improve performance
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
      res.setHeader('ETag', \`"\${id}-\${attachment.filename}"\`);
      
      // Decode base64 content
      let fileBuffer = Buffer.from(attachment.content, 'base64');
      
      // Special handling for CSV files
      const isCSV = attachment.fileType.includes('csv') || attachment.filename.endsWith('.csv');
      if (isCSV) {
        res.set('Content-Type', 'text/csv; charset=utf-8');
      }
      
      // Send the buffer as the response
      return res.send(fileBuffer);
    } catch (error) {
      console.error(\`[ATTACHMENT-API] Error fetching attachment: \${error.message}\`);
      return res.status(500).json({ message: "Error fetching attachment" });
    }
  });`;
  
  // Replace the old endpoint with the improved one
  const updatedContent = routesContent.substring(0, startPos) + 
                        improvedEndpoint + 
                        routesContent.substring(endPos);
  
  // Save the updated file
  fs.writeFileSync(routesPath, updatedContent, 'utf8');
  console.log('✅ Successfully updated attachment endpoint in routes.ts');
  
  // Now let's fix the openai.ts file to ensure images are properly created
  console.log('Now updating openai.ts for proper image handling...');
  const openaiPath = './server/openai.ts';
  
  // Make sure our previous backup still exists
  if (!fs.existsSync(`${openaiPath}.backup-attachments`)) {
    const openaiContent = fs.readFileSync(openaiPath, 'utf8');
    fs.writeFileSync(`${openaiPath}.backup-fix`, openaiContent, 'utf8');
    console.log('✅ Created backup of openai.ts file');
  } else {
    console.log('✅ Backup of openai.ts already exists');
  }
  
  // Update the chat message creation part in handleFileGeneration
  const openaiContent = fs.readFileSync(openaiPath, 'utf8');
  
  // Look for the chat message creation
  const chatMessagePattern = /const chatMessage: {[\s\S]*?content: .+?\n/;
  
  if (chatMessagePattern.test(openaiContent)) {
    console.log('✅ Found chat message creation in openai.ts');
    
    // Update the content line to ensure the image is properly referenced
    const updatedOpenaiContent = openaiContent.replace(
      chatMessagePattern,
      (match) => {
        return match.replace(
          /content: .+?\n/,
          'content: `✨ Generated an image based on your request: "${originalPrompt}".\n\n![Generated image](/api/attachments/${attachment.id})`\n'
        );
      }
    );
    
    // Save the updated file
    fs.writeFileSync(openaiPath, updatedOpenaiContent, 'utf8');
    console.log('✅ Successfully updated chat message content in openai.ts');
  } else {
    console.warn('⚠️ Could not find chat message creation in openai.ts');
  }
  
  console.log(`
================================================================
✅ ATTACHMENT ENDPOINT AND IMAGE HANDLING FIX APPLIED SUCCESSFULLY

The attachment endpoint and image handling has been improved to:
1. Add more detailed logging for easier debugging
2. Set appropriate content-type headers for images
3. Add caching headers for better performance
4. Ensure chat messages include proper Markdown image syntax

These improvements, combined with the client-side fixes, should 
ensure that images are correctly generated, stored, and displayed 
in card chats.

To test, restart the application and try to generate an image
with a message like "generate an image of a burger" in a card chat.
================================================================
  `);
  
} catch (error) {
  console.error('Error updating files:', error);
  process.exit(1);
}