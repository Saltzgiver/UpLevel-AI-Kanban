/**
 * Targeted fix for image rendering in chat component
 * 
 * This script provides a focused fix for the angle bracket image rendering issue
 * in the GPT Chat component. It specifically enhances the renderImageInMarkdown
 * function to better handle three cases:
 * 
 * 1. Empty source URLs with "Generated image" alt text
 * 2. Angle bracket format (![Generated image](<description>))
 * 3. Standard attachment URLs (/api/attachments/123)
 */

import fs from 'fs';
import path from 'path';

// Path to the original file
const gptChatPath = './client/src/components/gpt/gpt-chat.tsx';

try {
  console.log('Starting targeted fix for image rendering...');
  
  // Read the current file
  const fileContent = fs.readFileSync(gptChatPath, 'utf8');
  
  // Find the renderImageInMarkdown function
  const renderImageFunctionRegex = /const renderImageInMarkdown = \(src: string, alt: string\) => \{[\s\S]*?(?=const handleSendMessage|return \()/;
  const match = fileContent.match(renderImageFunctionRegex);
  
  if (!match) {
    console.error('Could not find the renderImageInMarkdown function in the file');
    process.exit(1);
  }
  
  console.log('Found renderImageInMarkdown function');
  
  // Create the improved version of the function
  const improvedFunction = `const renderImageInMarkdown = (src: string, alt: string) => {
    // Log the image source for debugging
    console.log(\`🖼️ [GPTChat:\${cardId}] Rendering image in markdown: \${src}\`, { alt });
    
    // Handle empty source with "Generated image" alt text - indicates an image reference
    // without a proper URL but we can try to find the matching attachment
    if ((!src || src === '') && alt === 'Generated image') {
      console.log(\`🖼️ [GPTChat:\${cardId}] Empty source with 'Generated image' alt text - looking for attachment\`);
      
      // Find any image attachments sorted by most recent first
      if (attachments && attachments.length > 0) {
        const imageAttachments = attachments.filter(a => a.mimetype?.includes('image'));
        
        if (imageAttachments.length > 0) {
          const sortedAttachments = [...imageAttachments].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          
          const mostRecentAttachment = sortedAttachments[0];
          console.log(\`🖼️ [GPTChat:\${cardId}] Found recent image attachment: \${mostRecentAttachment.id}\`);
          
          const imageSrc = \`/api/attachments/\${mostRecentAttachment.id}\`;
          
          return (
            <div className="my-2 inline-block">
              <div className="relative cursor-pointer group overflow-hidden rounded-md border border-gray-200">
                <div className="absolute top-1 right-1 z-10 bg-black/60 text-white px-1 py-0.5 text-[8px] rounded-sm">
                  AI Generated
                </div>
                <div className="absolute top-1 left-1 z-10 bg-black/60 text-white px-1 py-0.5 text-[8px] rounded-sm flex items-center opacity-70 group-hover:opacity-100">
                  <Maximize2 className="h-2.5 w-2.5 mr-0.5" />
                  <span>View full size</span>
                </div>
                <img 
                  src={imageSrc} 
                  alt="AI Generated Image" 
                  className="max-w-full max-h-64 object-cover" 
                  onClick={() => setSelectedImage({ src: imageSrc, alt: 'AI Generated Image' })}
                  onLoad={() => console.log(\`🖼️ [GPTChat:\${cardId}] Image loaded successfully: \${mostRecentAttachment.id}\`)}
                  onError={(e) => console.error(\`🖼️ [GPTChat:\${cardId}] Error loading image: \${mostRecentAttachment.id}\`, e)}
                />
              </div>
            </div>
          );
        }
      }
    }
    
    // Check for special cases - angle brackets indicate placeholder text, not a real URL
    if (src.startsWith('<') && src.endsWith('>')) {`;
  
  // Replace the function in the file
  const updatedContent = fileContent.replace(
    renderImageFunctionRegex,
    improvedFunction
  );
  
  // Write the updated file to a temporary location for safety
  const backupPath = './client/src/components/gpt/gpt-chat.tsx.improved';
  fs.writeFileSync(backupPath, updatedContent, 'utf8');
  
  console.log(`
==============================================================
TARGETED IMAGE RENDERING FIX
==============================================================

This script has created a fixed version of the GPT Chat component
with improved image rendering capabilities. The fixed file is at:
${backupPath}

To apply the fix, you can:
1. Back up your current file:
   cp client/src/components/gpt/gpt-chat.tsx client/src/components/gpt/gpt-chat.tsx.bak

2. Apply the improved version:
   cp client/src/components/gpt/gpt-chat.tsx.improved client/src/components/gpt/gpt-chat.tsx

This fix enhances image rendering to better handle:
- Empty image sources with "Generated image" alt text
- Angle bracket format (![Generated image](<description>))
- Standard attachment URLs (/api/attachments/123)

==============================================================
  `);
  
} catch (error) {
  console.error('Error:', error);
}