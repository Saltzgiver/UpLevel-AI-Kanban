/**
 * Fix the extension variable declaration to use 'let' instead of 'const'
 * 
 * This script updates the extension variable in handleFileGeneration to allow reassignment.
 */

import fs from 'fs';
import path from 'path';

// Path to the openai.ts file
const openaiFilePath = './server/openai.ts';

// Read the content of the file
try {
  const fileContent = fs.readFileSync(openaiFilePath, 'utf8');

  // Find the pattern to replace
  const findPattern = /const extension = fileType\.split\('\/'\)\[1\] \|\| 'png';/;
  
  // Check if the pattern exists
  if (!findPattern.test(fileContent)) {
    console.log('❌ Could not find the pattern to replace. The file structure might have changed.');
    process.exit(1);
  }

  // Replace const with let to allow reassignment
  const updatedContent = fileContent.replace(
    findPattern, 
    'let extension = fileType.split(\'/\')[1] || \'png\';'
  );
  
  // Write the updated content back to the file
  fs.writeFileSync(openaiFilePath, updatedContent, 'utf8');
  
  console.log('✅ Successfully updated the extension variable from const to let');
  console.log('The extension variable can now be reassigned as needed.');
  
} catch (error) {
  console.error('Error updating the file:', error.message);
  process.exit(1);
}