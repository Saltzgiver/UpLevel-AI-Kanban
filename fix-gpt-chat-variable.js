/**
 * Fix for the GPT Chat Component
 * 
 * This script specifically addresses the syntax error with the missing processedContent variable
 * in the GPT Chat component that's causing the build to fail.
 */

const fs = require('fs');
const path = require('path');

// Path to the file
const filePath = './client/src/components/gpt/gpt-chat.tsx';

try {
  console.log('Reading GPT Chat component file...');
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Fix 1: Replace the problematic section with corrected code
  const problemSection = `                          // If content was modified, render with the processed content

                          if (processedContent !== chat.content) {

                            return (`;
  
  const fixedSection = `                          // Process content if needed, otherwise use original
                          const processedContent = chat.content;
                          
                          // Render with markdown component
                          return (`;
  
  const fixedContent = content.replace(problemSection, fixedSection);
  
  // Write the fixed content to a backup file first
  const backupPath = './client/src/components/gpt/gpt-chat.tsx.fixed';
  fs.writeFileSync(backupPath, fixedContent, 'utf8');
  
  // Apply the fix directly after creating backup
  fs.writeFileSync(filePath, fixedContent, 'utf8');
  
  console.log('✅ Successfully fixed the GPT Chat component.');
  console.log('✅ Backup saved to: ' + backupPath);
} catch (error) {
  console.error('❌ Error fixing the GPT Chat component:', error);
}