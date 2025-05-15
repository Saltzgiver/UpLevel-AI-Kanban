/**
 * Restore GPT Chat Component to Working State
 * 
 * This script replaces the problematic syntax in the GPT Chat component
 * with a known working version to get the application functional again.
 */

const fs = require('fs');
const path = require('path');

// Create a clean backup first
try {
  const originalFile = fs.readFileSync('./client/src/components/gpt/gpt-chat.tsx', 'utf8');
  fs.writeFileSync('./client/src/components/gpt/gpt-chat.tsx.bak', originalFile, 'utf8');
  console.log('✅ Backup created at ./client/src/components/gpt/gpt-chat.tsx.bak');
} catch (err) {
  console.error('Error creating backup:', err);
  process.exit(1);
}

// The problematic section with indentation and syntax issues
const problematicSection = `                          }  // Close the else pattern checks


                          // Process content if needed, otherwise use original
                          const processedContent = chat.content;
                          
                          // Render with markdown component
                          return (

                      <ReactMarkdown`;

// The corrected section with proper indentation and syntax
const correctedSection = `                          }  // Close the else pattern checks

                          // Simply render with the original content
                          return (
                            <ReactMarkdown`;

try {
  let fileContent = fs.readFileSync('./client/src/components/gpt/gpt-chat.tsx', 'utf8');
  
  // Check if the problematic section exists
  if (fileContent.includes(problematicSection)) {
    // Replace the problematic section
    fileContent = fileContent.replace(problematicSection, correctedSection);
    
    // Replace processedContent with chat.content throughout the file
    fileContent = fileContent.replace(/\{processedContent\}/g, '{chat.content}');
    
    // Write the fixed content back to the file
    fs.writeFileSync('./client/src/components/gpt/gpt-chat.tsx', fileContent, 'utf8');
    console.log('✅ Fixed GPT Chat component successfully');
  } else {
    console.log('⚠️ Could not find the exact problematic section. Trying alternative approach...');
    
    // Alternative approach: Use regex to find and fix the general pattern
    const regex = /\}\s*\/\/\s*Close the else pattern checks\s*\/\/\s*Process content if needed[^\n]*\s*const processedContent[^\n]*\s*\/\/\s*Render with markdown[^\n]*\s*return\s*\(\s*<ReactMarkdown/gs;
    const replacement = `}  // Close the else pattern checks

                          // Simply render with the original content
                          return (
                            <ReactMarkdown`;
    
    fileContent = fileContent.replace(regex, replacement);
    fileContent = fileContent.replace(/\{processedContent\}/g, '{chat.content}');
    
    fs.writeFileSync('./client/src/components/gpt/gpt-chat.tsx', fileContent, 'utf8');
    console.log('✅ Fixed GPT Chat component using alternative approach');
  }
} catch (err) {
  console.error('Error fixing file:', err);
}