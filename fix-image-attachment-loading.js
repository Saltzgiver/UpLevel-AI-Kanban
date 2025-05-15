/**
 * Fix Image Attachment Loading in GPT Chat Components
 * 
 * This script addresses the issue where images are being generated but not displayed
 * in the chat interface due to problems with attachment loading.
 * 
 * The fixes include:
 * 1. Updating the GPT Chat component to properly load and display card attachments
 * 2. Adding additional debugging to diagnose attachment loading issues
 * 3. Ensuring the correct card attachments are being fetched when a chat is opened
 */

import fs from 'fs';

// Path to the client-side gpt-chat.tsx file
const gptChatPath = './client/src/components/gpt/gpt-chat.tsx';

try {
  console.log('Reading gpt-chat.tsx file...');
  const gptChatContent = fs.readFileSync(gptChatPath, 'utf8');
  
  // Make a backup of the original file before making changes
  fs.writeFileSync(`${gptChatPath}.backup-attachments`, gptChatContent, 'utf8');
  console.log('✅ Created backup of gpt-chat.tsx file');
  
  // 1. Add an explicit loading of attachments when a card is viewed
  let updatedContent = gptChatContent;
  
  // First, let's look for problems in how attachments are being logged or processed
  if (updatedContent.includes('No attachments available')) {
    console.log('✅ Found "No attachments available" message in code');
    
    // Add more detailed attachment debugging
    updatedContent = updatedContent.replace(
      /console\.log\(`📎 \[GPTChat:\${cardId}\] No attachments available`\);/,
      'console.log(`📎 [GPTChat:${cardId}] No attachments available. Attachments prop:`, attachments);\n' +
      '      // Try to invalidate the attachments query to force a refresh\n' +
      '      if (cardId && typeof cardId === "number") {\n' +
      '        console.log(`📎 [GPTChat:${cardId}] Forcing refresh of attachments`);\n' +
      '        // Use setTimeout to avoid React state updates during render\n' +
      '        setTimeout(() => {\n' +
      '          queryClient.invalidateQueries({ queryKey: [`/api/cards/${cardId}`] });\n' +
      '        }, 100);\n' +
      '      }'
    );
  }
  
  // Fix the issue with ReactMarkdown not handling attachments properly
  // Look for the ReactMarkdown component in the render function
  const markdownComponentRegex = /(.*<ReactMarkdown[\s\S]*?components={)({[\s\S]*?})(\s*}>[\s\S]*?<\/ReactMarkdown>)/;
  
  if (markdownComponentRegex.test(updatedContent)) {
    console.log('✅ Found ReactMarkdown component in render function');
    
    // Extract the current components config and enhance it to handle images better
    updatedContent = updatedContent.replace(
      markdownComponentRegex,
      (match, prefix, componentsObj, suffix) => {
        // Parse the current components object
        let enhancedComponents = componentsObj;
        
        // If it doesn't already have an img handler, add one
        if (!enhancedComponents.includes('img:')) {
          // Add an img component that will handle attachment URLs properly
          enhancedComponents = enhancedComponents.replace(
            /{/,
            `{
            img: ({node, ...props}) => {
              // Check if this is an attachment URL
              if (props.src && props.src.startsWith('/api/attachments/')) {
                console.log('📎 [MarkdownRenderer] Rendering attachment image:', props.src);
                return (
                  <img 
                    {...props}
                    className="max-w-full rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setSelectedImage({src: props.src, alt: props.alt || 'Image attachment'})}
                    onLoad={() => console.log('📎 [MarkdownRenderer] Image loaded successfully:', props.src)}
                    onError={(e) => console.error('📎 [MarkdownRenderer] Error loading image:', props.src, e)}
                  />
                );
              }
              
              // Default handling for other images
              return <img {...props} className="max-w-full rounded-md" />;
            },`
          );
        }
        
        return `${prefix}${enhancedComponents}${suffix}`;
      }
    );
  }
  
  // Add useEffect to fetch attachments when the component mounts
  if (!updatedContent.includes('fetch attachments')) {
    console.log('✅ Adding effect to fetch attachments when component mounts');
    
    // Look for a good place to add the useEffect - after other useEffects
    const effectPosition = updatedContent.lastIndexOf('useEffect(');
    
    if (effectPosition !== -1) {
      // Find the end of this useEffect block
      let depth = 0;
      let endPosition = effectPosition;
      let inString = false;
      let stringChar = '';
      
      for (let i = effectPosition; i < updatedContent.length; i++) {
        const char = updatedContent[i];
        
        // Handle string literals to avoid counting braces inside strings
        if ((char === '"' || char === "'" || char === '`') && 
            (i === 0 || updatedContent[i-1] !== '\\')) {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
          }
        }
        
        if (!inString) {
          if (char === '{') depth++;
          if (char === '}') {
            depth--;
            if (depth === 0) {
              endPosition = i + 1;
              break;
            }
          }
        }
      }
      
      // Insert our new useEffect after the last one
      if (endPosition !== effectPosition) {
        const before = updatedContent.substring(0, endPosition);
        const after = updatedContent.substring(endPosition);
        
        updatedContent = before + `
  
  // Fetch attachments when component mounts or cardId changes
  useEffect(() => {
    if (cardId && typeof cardId === "number") {
      console.log(\`📎 [GPTChat:\${cardId}] Fetching attachments for card\`);
      
      // Ensure we have the latest attachments
      queryClient.invalidateQueries({ queryKey: [\`/api/cards/\${cardId}\`] });
      
      // Also check for any specific attachment URLs in the chat messages
      const attachmentUrls = chats
        .filter(chat => chat.content && chat.content.includes('/api/attachments/'))
        .map(chat => {
          const matches = chat.content.match(/\\/api\\/attachments\\/([0-9]+)/g);
          return matches ? matches.map(url => parseInt(url.split('/').pop())) : [];
        })
        .flat()
        .filter(id => id && !isNaN(id));
      
      if (attachmentUrls.length > 0) {
        console.log(\`📎 [GPTChat:\${cardId}] Found attachment URLs in messages:\`, attachmentUrls);
        // Force refresh of all attachment resources
        attachmentUrls.forEach(id => {
          queryClient.invalidateQueries({ queryKey: [\`/api/attachments/\${id}\`] });
        });
      }
    }
  }, [cardId]);` + after;
      }
    }
  }
  
  // Save the updated file
  fs.writeFileSync(gptChatPath, updatedContent, 'utf8');
  console.log('✅ Successfully updated gpt-chat.tsx file');
  
  console.log(`
================================================================
✅ IMAGE ATTACHMENT LOADING FIX APPLIED SUCCESSFULLY

The GPT Chat component has been updated to:
1. Properly handle and display image attachments in messages
2. Add detailed logging for attachment loading issues
3. Ensure attachments are fetched when a card chat is opened

This fix should resolve the issue where images are generated but not displayed.
To test the fix, open a card chat and try to generate an image with a message like 
"generate an image of a burger".
================================================================
  `);
  
} catch (error) {
  console.error('Error updating the file:', error);
  process.exit(1);
}