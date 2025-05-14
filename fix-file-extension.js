/**
 * Fix for the file extension issue in handleFileGeneration
 * 
 * This script patches the handleFileGeneration function to ensure
 * that image attachments are correctly saved with the right extension.
 */

import fs from 'fs';
import path from 'path';

// Path to the openai.ts file
const openaiFilePath = './server/openai.ts';

// Read the content of the file
try {
  const fileContent = fs.readFileSync(openaiFilePath, 'utf8');

  // Identify the area where the file extension is determined
  const findFileExtensionPattern = /const extension = fileType\.split\('\/'\)\[1\] \|\| 'png';/;
  
  // Check if the current pattern exists
  if (!findFileExtensionPattern.test(fileContent)) {
    console.log('❌ Could not find the pattern to replace. The file structure might have changed.');
    process.exit(1);
  }

  // New improved file extension logic
  const newExtensionLogic = `const extension = fileType.split('/')[1] || 'png';
        
        // Ensure proper image extensions for images
        if (fileType.startsWith('image/')) {
          // Force specific extensions for common image types to ensure proper display
          if (fileType === 'image/png') {
            extension = 'png';
          } else if (fileType === 'image/jpeg' || fileType === 'image/jpg') {
            extension = 'jpg';
          } else if (fileType === 'image/webp') {
            extension = 'webp';
          } else if (fileType === 'image/gif') {
            extension = 'gif';
          }
          
          console.log(\`[IMAGE-PROCESS] Using image extension: \${extension} for MIME type: \${fileType}\`);
        } else {
          console.log(\`[IMAGE-PROCESS] Using default extension: \${extension} for MIME type: \${fileType}\`);
        }`;
  
  // Replace the old extension logic with the new one
  const updatedContent = fileContent.replace(findFileExtensionPattern, newExtensionLogic);
  
  // Write the updated content back to the file
  fs.writeFileSync(openaiFilePath, updatedContent, 'utf8');
  
  console.log('✅ Successfully updated the file extension logic in handleFileGeneration');
  console.log('Images will now be saved with the correct extensions based on their MIME types.');
  
} catch (error) {
  console.error('Error updating the file:', error.message);
  process.exit(1);
}