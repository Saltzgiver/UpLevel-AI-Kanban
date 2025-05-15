/**
 * Script to fix the processedContent variable error
 * This specifically targets the error at line 874
 */

import fs from 'fs';

try {
  // Read the file content
  const filePath = './client/src/components/gpt/gpt-chat.tsx';
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Create a backup
  fs.writeFileSync('./client/src/components/gpt/gpt-chat.tsx.bak2', content, 'utf8');
  console.log('✅ Created backup at ./client/src/components/gpt/gpt-chat.tsx.bak2');
  
  // The problematic section with indentation issues
  const problematicSection = 
`                          // Process content if needed, otherwise use original
                          const processedContent = chat.content;
                          
                          // Render with markdown component
                          return (

                      <ReactMarkdown`;
  
  // The fixed section with proper indentation
  const fixedSection = 
`                          // Simply use the original content
                          return (
                            <ReactMarkdown`;
  
  // Replace the problematic section
  if (content.includes(problematicSection)) {
    content = content.replace(problematicSection, fixedSection);
    
    // Also replace any references to processedContent with chat.content
    content = content.replace(/\{processedContent\}/g, '{chat.content}');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Successfully fixed processedContent error');
  } else {
    console.log('⚠️ Could not find exact problematic section, trying alternate approach...');
    
    // Regex approach to find similar patterns
    const regex = /\/\/\s*Process content if needed[^\n]*\s*const processedContent[^\n]*\s*\/\/\s*Render with markdown[^\n]*\s*return\s*\(\s*<ReactMarkdown/g;
    const replacement = 
`                          // Simply use the original content
                          return (
                            <ReactMarkdown`;
    
    content = content.replace(regex, replacement);
    content = content.replace(/\{processedContent\}/g, '{chat.content}');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Applied fix using regex approach');
  }
} catch (error) {
  console.error('❌ Error:', error);
}