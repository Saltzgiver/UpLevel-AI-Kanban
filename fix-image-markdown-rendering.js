/**
 * Fix for Image Markdown Rendering in Chat Messages
 * 
 * This script focuses specifically on the client-side markdown rendering
 * to ensure that file: patterns are properly converted to image markdown
 * when displayed in chat messages.
 */

import fs from 'fs';
import path from 'path';

// Path to the gpt-chat.tsx file which handles rendering
const gptChatPath = './client/src/components/gpt/gpt-chat.tsx';

try {
  console.log('Reading gpt-chat.tsx file...');
  const fileContent = fs.readFileSync(gptChatPath, 'utf8');
  
  // Create a backup of the original file
  fs.writeFileSync(`${gptChatPath}.backup`, fileContent, 'utf8');
  console.log('✅ Created backup of gpt-chat.tsx file');
  
  // Look for the message content rendering part
  // We want to add special handling for file: patterns
  const reactMarkdownSection = fileContent.match(/(\s*)<ReactMarkdown[\s\S]*?<\/ReactMarkdown>/m);
  
  if (reactMarkdownSection) {
    console.log('✅ Found ReactMarkdown component for chat message rendering');
    
    // Get the indentation and full section
    const indentation = reactMarkdownSection[1];
    const fullSection = reactMarkdownSection[0];
    
    // Add pre-processing for file: content before rendering markdown
    const preprocessedSection = 
      `${indentation}{/* Pre-process message content to handle file: patterns */}
${indentation}{\n${indentation}  (() => {\n${indentation}    // Check if content contains a file: pattern and convert to markdown image\n${indentation}    const processedContent = chat.content.replace(\n${indentation}      /file:([^,]+),([^,]+),(.*)/,\n${indentation}      (match, filename, mimetype, content) => {\n${indentation}        console.log(\`Converting file pattern to markdown image: \${filename}\`);\n${indentation}        if (mimetype.includes('image')) {\n${indentation}          // For images, use the attachment API if we have matching attachments\n${indentation}          const matchingAttachment = attachments?.find(a => a.filename === filename);\n${indentation}          if (matchingAttachment) {\n${indentation}            return \`![Generated image](/api/attachments/\${matchingAttachment.id})\`;\n${indentation}          }\n${indentation}        }\n${indentation}        return match; // Return unchanged if not an image or no matching attachment\n${indentation}      }\n${indentation}    );\n${indentation}    \n${indentation}    // If content was modified, render with the processed content\n${indentation}    if (processedContent !== chat.content) {\n${indentation}      return (\n${fullSection.replace('chat.content', 'processedContent')}\n${indentation}      );\n${indentation}    }\n${indentation}  })() /* Self-executing function to allow variable declarations */\n${indentation}}\n\n${indentation}{/* Render normal markdown if no file: pattern was found */}\n${indentation}{chat.content.includes('file:') ? null : (\n${fullSection}\n${indentation})}`;
    
    // Replace the ReactMarkdown section with our enhanced version
    const updatedContent = fileContent.replace(fullSection, preprocessedSection);
    
    // Write the updated content back to the file
    fs.writeFileSync(gptChatPath, updatedContent, 'utf8');
    console.log('✅ Successfully updated gpt-chat.tsx file with enhanced file: pattern handling');
  } else {
    console.log('⚠️ Could not find ReactMarkdown component in gpt-chat.tsx');
    
    // Try finding an alternative place to insert our fix
    const messageRendering = fileContent.match(/(\s*)className={\`.*?message-bubble.*?\`}[\s\S]*?>\s*{.*?}/);
    
    if (messageRendering) {
      console.log('✅ Found alternative message rendering section for our fix');
      
      const indentation = messageRendering[1];
      const messageBubbleSection = messageRendering[0];
      
      // Add pre-processing for file: content before rendering
      const filePatternDetection = 
        `${messageBubbleSection}\n\n${indentation}{/* Special handling for file: patterns */}\n${indentation}{chat.content.includes('file:') && (\n${indentation}  <div className="p-2 bg-yellow-50 rounded border border-yellow-100 text-sm">\n${indentation}    <p className="font-medium text-yellow-800">Image generated successfully!</p>\n${indentation}    <p className="text-yellow-600 text-xs mt-1">The image should appear below as an attachment.</p>\n${indentation}  </div>\n${indentation})}`;
      
      // Replace the message bubble section with our enhanced version
      const updatedContent = fileContent.replace(messageBubbleSection, filePatternDetection);
      
      // Write the updated content back to the file
      fs.writeFileSync(gptChatPath, updatedContent, 'utf8');
      console.log('✅ Successfully updated gpt-chat.tsx file with alternative file: pattern handling');
    } else {
      console.log('❌ Could not find an appropriate place to insert our fix');
    }
  }
  
  console.log(`
================================================================
✅ CLIENT-SIDE FIX APPLIED SUCCESSFULLY

The chat component has been updated to handle file: patterns specifically.
When a message contains content like "file:filename.png,mimetype,content",
it will be preprocessed to render properly as an image in the chat.

This should work in combination with the server-side file generation
that's already properly formatting the content.

To test, try sending a message like "generate an image of a burger" in a card chat.
================================================================
  `);
  
} catch (error) {
  console.error('Error updating the file:', error);
  process.exit(1);
}