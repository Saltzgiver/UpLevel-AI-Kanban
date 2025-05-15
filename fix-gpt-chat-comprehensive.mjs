/**
 * Create a comprehensive fix for the GPT Chat component
 */

import fs from 'fs';

const renderImageMarkdownCode = `
  // Function to render attachment images in messages
  const renderImageInMarkdown = (src: string, alt: string) => {
    // Log the image source for debugging
    console.log(\`🖼️ [GPTChat:\${cardId}] Rendering image in markdown: \${src}\`, { alt });
    
    // Handle empty source with "Generated image" alt text - indicates an image reference
    // without a proper URL but we can try to find the matching attachment
    if ((!src || src === '') && alt === 'Generated image') {
      console.log(\`🖼️ [GPTChat:\${cardId}] Empty source with 'Generated image' alt text - looking for attachment\`);
      
      // Find any image attachments sorted by most recent first
      if (attachments && attachments.length > 0) {
        const imageAttachments = attachments.filter(a => a.fileType?.includes('image'));
        
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
    if (src.startsWith('<') && src.endsWith('>')) {
      // Extract the text content from the brackets and create a meaningful fallback
      const placeholderText = src.substring(1, src.length - 1);
      console.log(\`🖼️ [GPTChat:\${cardId}] Found placeholder text instead of image URL: \${placeholderText}\`);
      
      // Try to locate an attachment based on the description 
      const matchingAttachment = attachments?.find(a => {
        // Look for attachments with content type image and created recently
        const isImage = a.fileType?.startsWith('image/');
        // Check if the filename might match the description
        const isRelevant = a.filename?.toLowerCase().includes('card') ||
                          a.filename?.toLowerCase().includes(placeholderText.toLowerCase().substring(0, 5));
        return isImage && isRelevant;
      });
      
      if (matchingAttachment) {
        console.log(\`🖼️ [GPTChat:\${cardId}] Found matching attachment for description:\`, matchingAttachment);
        // Use the attachment we found
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
                src={\`/api/attachments/\${matchingAttachment.id}\`} 
                alt="AI Generated Image" 
                className="max-w-full max-h-64 object-cover"
                onClick={() => setSelectedImage({ src: \`/api/attachments/\${matchingAttachment.id}\`, alt: 'AI Generated Image' })}
                onLoad={() => console.log(\`🖼️ [GPTChat:\${cardId}] Image loaded successfully: \${matchingAttachment.id}\`)}
                onError={(e) => console.error(\`🖼️ [GPTChat:\${cardId}] Error loading image: \${matchingAttachment.id}\`, e)}
              />
            </div>
          </div>
        );
      }
      
      // Fallback for when we can't find a matching attachment
      return (
        <div className="bg-gray-100 p-2 rounded my-1 text-xs italic">
          [Image: {placeholderText}]
          <div className="text-[10px] mt-1 text-gray-500">
            <RefreshCcw className="inline-block h-3 w-3 mr-1" />
            <span>Image generation in progress or unavailable</span>
          </div>
        </div>
      );
    }
    
    // Regular image URL - could be an attachment or external URL
    if (src && src.startsWith('/api/attachments/')) {
      console.log(\`🖼️ [GPTChat:\${cardId}] Rendering attachment image: \${src}\`);
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
              src={src} 
              alt={alt || "AI Generated Image"} 
              className="max-w-full max-h-64 object-cover"
              onClick={() => setSelectedImage({ src, alt: alt || 'AI Generated Image' })}
              onLoad={() => console.log(\`🖼️ [GPTChat:\${cardId}] Image loaded successfully: \${src}\`)}
              onError={(e) => console.error(\`🖼️ [GPTChat:\${cardId}] Error loading image: \${src}\`, e)}
            />
          </div>
        </div>
      );
    }
    
    // Default case - just render as a regular image
    return (
      <div className="my-2 inline-block">
        <img 
          src={src} 
          alt={alt} 
          className="max-w-full max-h-64 rounded-md"
          onClick={() => setSelectedImage({ src, alt })}
        />
      </div>
    );
  };
`;

try {
  // Read the current file
  const currentContent = fs.readFileSync('./client/src/components/gpt/gpt-chat.tsx', 'utf8');
  
  // First create a backup
  fs.writeFileSync('./client/src/components/gpt/gpt-chat.tsx.backup', currentContent, 'utf8');
  console.log('Created backup of gpt-chat.tsx');
  
  // Find and replace the renderImageInMarkdown function
  const functionStart = currentContent.indexOf('const renderImageInMarkdown');
  if (functionStart === -1) {
    console.error('Could not find renderImageInMarkdown function in the file');
    process.exit(1);
  }
  
  // Find the end of the function
  let bracketCount = 0;
  let endIndex = functionStart;
  let inString = false;
  let stringChar = '';
  let skipNextChar = false;
  
  for (let i = functionStart; i < currentContent.length; i++) {
    const char = currentContent[i];
    
    if (skipNextChar) {
      skipNextChar = false;
      continue;
    }
    
    if (char === '\\') {
      skipNextChar = true;
      continue;
    }
    
    if (!inString && (char === "'" || char === '"' || char === '`')) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar) {
      inString = false;
    }
    
    if (!inString) {
      if (char === '{') {
        bracketCount++;
      } else if (char === '}') {
        bracketCount--;
        if (bracketCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
  }
  
  if (endIndex === functionStart) {
    console.error('Could not find end of renderImageInMarkdown function');
    process.exit(1);
  }
  
  console.log(`Found renderImageInMarkdown function from index ${functionStart} to ${endIndex}`);
  
  // Replace the function with our improved version
  const newContent = 
    currentContent.substring(0, functionStart) + 
    renderImageMarkdownCode + 
    currentContent.substring(endIndex);
  
  // Check if we need to fix the processedContent variable
  if (newContent.includes('processedContent !== chat.content')) {
    console.log('Fixing processedContent variable');
    const fixedContent = newContent.replace(
      /if\s*\(\s*processedContent\s*!==\s*chat\.content\s*\)\s*\{[\s\S]*?return\s*\(/g,
      'return ('
    );
    
    // Also replace any references to processedContent with chat.content
    const finalContent = fixedContent.replace(/\{processedContent\}/g, '{chat.content}');
    
    fs.writeFileSync('./client/src/components/gpt/gpt-chat.tsx', finalContent, 'utf8');
  } else {
    fs.writeFileSync('./client/src/components/gpt/gpt-chat.tsx', newContent, 'utf8');
  }
  
  console.log('Successfully updated renderImageInMarkdown function');
} catch (err) {
  console.error('Error:', err);
}