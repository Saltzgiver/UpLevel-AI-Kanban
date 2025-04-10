import OpenAI from "openai";
import { ChatCompletionContentPart, ChatCompletionMessageParam } from "openai/resources";
import { storage } from "./storage";
import { Column, Attachment } from "@shared/schema";
import { extractCSVContent, createCSVAttachmentFromText } from './csv-helper';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const OPENAI_MODEL = "gpt-4o"; // Using GPT-4o which has vision capabilities built in

// Initialize OpenAI client
const getOpenAIClient = (apiKey?: string) => {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("No OpenAI API key provided");
  }
  console.log("Creating new OpenAI client, using model: " + OPENAI_MODEL);
  return new OpenAI({ apiKey: key });
};

// Helper function to convert base64 image to data URL for OpenAI vision API
const base64ToDataURL = (base64: string, mimeType: string): string => {
  // Remove any existing 'data:' prefixes if they exist
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
  
  // Ensure valid MIME type format
  const validMimeType = mimeType.includes('/') ? mimeType : `image/${mimeType}`;
  
  // Return properly formatted data URL
  return `data:${validMimeType};base64,${cleanBase64}`;
};

// Helper function to create OpenAI chat content with images
const createContentWithImages = (
  text: string, 
  attachments: Attachment[]
): ChatCompletionContentPart[] => {
  const contentParts: ChatCompletionContentPart[] = [
    { type: "text", text: `${text}\n\nIMPORTANT: Examine all attached images in this message and include detailed observations in your response. You have vision capabilities to analyze images.` }
  ];
  
  // Filter for image attachments and log them
  const imageAttachments = attachments.filter(att => att.fileType.includes('image'));
  
  console.log(`======== VISION REQUEST ========`);
  console.log(`Creating content with ${imageAttachments.length} images`);
  console.log(`Image attachments found: ${imageAttachments.map(a => `${a.id}:${a.filename}`).join(', ')}`);
  
  if (imageAttachments.length === 0) {
    console.log("WARNING: No image attachments found despite expecting images");
    console.log(`All attachments: ${attachments.map(a => `${a.id}:${a.filename}:${a.fileType}`).join(', ')}`);
  }
  
  // Add all image attachments to the content
  for (const attachment of imageAttachments) {
    try {
      console.log(`Processing image ${attachment.id} (${attachment.filename}), content length: ${attachment.content.length}`);
      
      // Convert base64 to data URL for GPT-4o's vision feature
      const dataUrl = base64ToDataURL(attachment.content, attachment.fileType);
      
      // Log the first 100 chars of the data URL to verify format
      console.log(`Image data URL format: ${dataUrl.substring(0, Math.min(100, dataUrl.length))}...`);
      
      // Add to content parts
      contentParts.push({
        type: "image_url",
        image_url: { url: dataUrl }
      });
      
      console.log(`Successfully added image attachment ${attachment.id} (${attachment.filename}) to message`);
    } catch (error) {
      console.error(`Error processing image attachment ${attachment.id} (${attachment.filename}):`, error);
    }
  }
  
  console.log(`Total content parts created: ${contentParts.length}`);
  console.log(`======== END VISION REQUEST ========`);
  
  return contentParts;
};

/**
 * Processes a card with GPT when it's moved to a GPT-enabled column
 */
export async function triggerGPTProcessing(cardId: number, column: Column): Promise<void> {
  try {
    // Mark the card as processing
    await storage.updateCard(cardId, { processing: true });
    
    // Get the card with all its data
    const card = await storage.getCardById(cardId);
    if (!card) {
      throw new Error(`Card with ID ${cardId} not found`);
    }

    // Initialize OpenAI client with column's API key if available
    const openai = getOpenAIClient(column.apiKey || undefined);

    // Build the prompt for GPT
    let prompt = `You are ${column.gptName || "an AI assistant"}. `;
    
    if (column.gptInstructions) {
      prompt += `${column.gptInstructions}\n\n`;
    } else {
      prompt += "Your task is to analyze and process the following card content.\n\n";
    }

    prompt += `Card Title: ${card.title}\n`;
    prompt += `Card Description: ${card.description || "No description provided."}\n\n`;

    // Include the card's most recent GPT output if it exists
    if (card.gptOutput) {
      prompt += `Previous GPT Output: ${card.gptOutput}\n\n`;
    }

    // Include existing chats for context if enabled for this card
    if (card.includeChatHistory && card.chats && card.chats.length > 0) {
      prompt += "Previous conversations:\n";
      for (const chat of card.chats) {
        prompt += `${chat.role === 'assistant' ? 'AI' : 'User'}: ${chat.content}\n`;
      }
      prompt += "\n";
    }
    
    // Include attachments if any
    if (card.attachments && card.attachments.length > 0) {
      prompt += "Attached files:\n";
      for (const attachment of card.attachments) {
        prompt += `- ${attachment.filename} (${attachment.fileType})\n`;
        
        // For text-based files (txt, md, etc.), include the content directly
        if (attachment.fileType.includes('text') || 
            attachment.filename.endsWith('.txt') || 
            attachment.filename.endsWith('.md')) {
          prompt += `Content of ${attachment.filename}:\n${attachment.content}\n\n`;
        } 
        // Special handling for CSV files to help the model understand the structure
        else if (attachment.filename.endsWith('.csv') || attachment.fileType.includes('csv')) {
          try {
            // Attempt to decode the content
            let csvContent = '';
            try {
              csvContent = Buffer.from(attachment.content, 'base64').toString('utf-8');
            } catch (e) {
              csvContent = attachment.content; // Fallback to the raw content if not base64
            }
            
            // Add some context about the CSV structure
            prompt += `CSV data from ${attachment.filename}:\n`;
            
            // Get first few lines to show structure
            const lines = csvContent.split('\n').slice(0, 10);
            if (lines.length > 0) {
              // Assume first line might be header
              const header = lines[0];
              prompt += `Headers: ${header}\n\n`;
              
              // Show a few data rows
              prompt += `Sample data (first ${Math.min(5, lines.length - 1)} rows):\n`;
              for (let i = 1; i < Math.min(6, lines.length); i++) {
                prompt += `${lines[i]}\n`;
              }
              
              if (lines.length > 6) {
                prompt += `...and ${lines.length - 6} more rows\n`;
              }
              
              // Add instructions for CSV analysis
              prompt += `\nPlease analyze this CSV data in your response. You can reference columns by name and extract insights from the data.\n\n`;
            } else {
              prompt += `CSV appears to be empty.\n\n`;
            }
          } catch (error) {
            console.error("Error processing CSV content:", error);
            prompt += `Content of ${attachment.filename} (CSV file - could not be parsed):\n${attachment.content.substring(0, 500)}...\n\n`;
          }
        } else if (attachment.fileType.includes('image')) {
          // For images, just note that there's an image attached
          prompt += `Note: This is an image file. Please reference it by filename if needed.\n\n`;
        } else {
          // For other file types, add a generic note
          prompt += `Note: This is a ${attachment.fileType} file. You can reference it by filename.\n\n`;
        }
      }
    }

    prompt += "Please process this information and provide a helpful response. " +
      "You can reference the attached files in your analysis. " +
      "You can also generate new files if appropriate, using the following syntax:\n" +
      "```file:filename.ext,mimetype,content```\n" +
      "For example, to create a CSV file: ```file:data.csv,text/csv,column1,column2\nvalue1,value2```\n" +
      "If you want to generate tags for this card to help with categorization, include a line at the end starting with 'TAGS:' followed by comma-separated tags.";

    // Prepare the messages array
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: prompt }
    ];
    
    // Prepare user message, potentially with image attachments
    let userContent: string | ChatCompletionContentPart[] = `Process this card: ${card.title}`;
    
    // Check if we have image attachments to include
    if (card.attachments && card.attachments.length > 0) {
      const imageAttachments = card.attachments.filter(att => att.fileType.includes('image'));
      
      console.log(`======== CARD IMAGE PROCESSING ========`);
      console.log(`Card ${cardId} has ${card.attachments.length} attachments, ${imageAttachments.length} are images`);
      
      // If we have image attachments, format the content with text and images
      if (imageAttachments.length > 0) {
        // Update the system message to explicitly mention vision capabilities 
        prompt += "\n\nIMPORTANT: You have vision capabilities and MUST analyze all images. Examine images in detail and include your observations in your response. These images are directly visible to you.";
        
        // Update the messages array
        messages[0].content = prompt;
        
        userContent = createContentWithImages(`Process this card: ${card.title}`, card.attachments);
        console.log(`Prepared card processing message with ${imageAttachments.length} images`);
        
        // Log image names for debugging
        console.log(`Images included: ${imageAttachments.map(img => img.filename).join(', ')}`);
      } else {
        console.log(`No image attachments found despite having ${card.attachments.length} attachments`);
        console.log(`Attachment types: ${card.attachments.map(att => att.fileType).join(', ')}`);
      }
      console.log(`======== END CARD IMAGE PROCESSING ========`);
    }
    
    // Add the user message with any image attachments
    messages.push({ role: "user", content: userContent });
    
    console.log(`Sending card to OpenAI with model ${OPENAI_MODEL}, including ${typeof userContent === 'string' ? 0 : userContent.length - 1} images`);
    
    // Log the exact model we're using to see if it's being overridden somewhere
    console.log(`Using OpenAI model: ${OPENAI_MODEL}`);
    
    // Call OpenAI API with explicit model parameter
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL, // gpt-4o has vision capabilities built in
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });
  
    // If we get here, the API call was successful
    console.log(`Successfully completed request with model ${OPENAI_MODEL}`);
    
    const response = completion.choices[0].message.content || "";

    // Extract tags if provided
    let gptOutput = response;
    let gptTags = null;

    const tagsMatch = response.match(/TAGS:\s*(.+)$/m);
    if (tagsMatch && tagsMatch[1]) {
      gptTags = tagsMatch[1].trim();
      // Remove the tags line from the output
      gptOutput = response.replace(/TAGS:\s*.+$/m, "").trim();
    }

    // Update card with GPT response
    await storage.updateCard(cardId, {
      gptOutput,
      gptTags,
      processing: false
    });

    // Add GPT's response as a chat message with GPT name and color
    await storage.createChat({
      cardId,
      role: "assistant",
      content: gptOutput,
      gptName: column.gptName || "AI Assistant",
      gptColor: column.gptColor
    });

    // Handle file generation if indicated in the response
    await handleFileGeneration(cardId, response);

  } catch (error) {
    console.error("Error processing card with GPT:", error);
    
    // More informative error message
    const errorMessage = error instanceof Error 
      ? error.message
      : "Unknown error occurred while processing";
    
    // Check for rate limits or token limits specifically
    let userFriendlyError = errorMessage;
    if (errorMessage.includes("rate limit")) {
      userFriendlyError = "OpenAI API rate limit exceeded. Please try again in a few moments.";
    } else if (errorMessage.includes("maximum context length")) {
      userFriendlyError = "The card content is too large for processing. Please reduce the content or split it into multiple cards.";
    } else if (errorMessage.includes("API key")) {
      userFriendlyError = "Invalid or missing OpenAI API key. Please update the API key in column settings.";
    }
    
    // Update card with clear error message and stop processing
    await storage.updateCard(cardId, {
      processing: false,
      gptOutput: `Error processing with GPT: ${userFriendlyError}`
    });
    
    // Also add as chat message for visibility with GPT name and color
    await storage.createChat({
      cardId,
      role: "assistant",
      content: `⚠️ Error: ${userFriendlyError}`,
      gptName: column.gptName || "AI Assistant",
      gptColor: column.gptColor
    });

    throw error;
  }
}

/**
 * Processes a chat message with GPT
 */
export async function processChat(cardId: number, userMessage: string, column: Column): Promise<void> {
  try {
    // Update card to mark as processing
    await storage.updateCard(cardId, { processing: true });
    
    // Get the card with all its data
    const card = await storage.getCardById(cardId);
    if (!card) {
      throw new Error(`Card with ID ${cardId} not found`);
    }

    // Initialize OpenAI client with column's API key if available
    const openai = getOpenAIClient(column.apiKey || undefined);

    // Build conversation history
    // Create system message with context about the card, including attachments
    let systemContent = `You are ${column.gptName || "an AI assistant"}. ${column.gptInstructions || ""}\n\n` +
      `You are continuing a conversation about a card titled "${card.title}" with description: "${card.description || "No description provided."}"\n\n` +
      `${card.gptTags ? `This card has the following tags: ${card.gptTags}\n\n` : ""}` +
      `${card.gptOutput ? `Previous GPT output for this card: ${card.gptOutput}\n\n` : ""}`;
    
    // Include attachments if any
    if (card.attachments && card.attachments.length > 0) {
      systemContent += "This card has the following attachments:\n";
      for (const attachment of card.attachments) {
        systemContent += `- ${attachment.filename} (${attachment.fileType})\n`;
        
        // For text-based files (txt, md, etc.), include the content directly
        if (attachment.fileType.includes('text') || 
            attachment.filename.endsWith('.txt') || 
            attachment.filename.endsWith('.md')) {
          systemContent += `Content of ${attachment.filename}:\n${attachment.content}\n\n`;
        } 
        // Special handling for CSV files to help the model understand the structure
        else if (attachment.filename.endsWith('.csv') || attachment.fileType.includes('csv')) {
          try {
            // Attempt to decode the content
            let csvContent = '';
            try {
              csvContent = Buffer.from(attachment.content, 'base64').toString('utf-8');
            } catch (e) {
              csvContent = attachment.content; // Fallback to the raw content if not base64
            }
            
            // Add some context about the CSV structure
            systemContent += `CSV data from ${attachment.filename}:\n`;
            
            // Get first few lines to show structure
            const lines = csvContent.split('\n').slice(0, 10);
            if (lines.length > 0) {
              // Assume first line might be header
              const header = lines[0];
              systemContent += `Headers: ${header}\n\n`;
              
              // Show a few data rows
              systemContent += `Sample data (first ${Math.min(5, lines.length - 1)} rows):\n`;
              for (let i = 1; i < Math.min(6, lines.length); i++) {
                systemContent += `${lines[i]}\n`;
              }
              
              if (lines.length > 6) {
                systemContent += `...and ${lines.length - 6} more rows\n`;
              }
              
              // Add instructions for CSV analysis
              systemContent += `\nPlease analyze this CSV data in your response if the user asks about it. You can reference columns by name.\n\n`;
            } else {
              systemContent += `CSV appears to be empty.\n\n`;
            }
          } catch (error) {
            console.error("Error processing CSV content:", error);
            systemContent += `Content of ${attachment.filename} (CSV file - could not be parsed):\n${attachment.content.substring(0, 500)}...\n\n`;
          }
        } else if (attachment.fileType.includes('image')) {
          // For images, we'll include them in the actual message content later
          systemContent += `Note: This is an image file (${attachment.filename}). You'll be able to view and analyze it.\n\n`;
        } else {
          // For other file types, add a generic note
          systemContent += `Note: This is a ${attachment.fileType} file. You can reference it by filename.\n\n`;
        }
      }
    }
    
    systemContent += "Respond helpfully and concisely to the user's message. " + 
      "You can reference and analyze the attached files in your response as needed. " + 
      "For file generation, use this syntax: ```file:filename.ext,mimetype,content```\n\n" + 
      "If the user asks for an image, respond conversationally as if you've created it. " + 
      "The system will handle the actual image generation in the background. " + 
      "For example, if a user says 'create an image of a cat', simply respond with 'I've created an image of a cat for you' " + 
      "or similar natural language. Don't mention DALL-E or API limitations.";
    
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemContent
      }
    ];

    // Add chat history if enabled for this card
    if (card.includeChatHistory && card.chats && card.chats.length > 0) {
      for (const chat of card.chats) {
        messages.push({
          role: chat.role as "user" | "assistant",
          content: chat.content
        });
      }
    }

    // Check if this is an image generation request
    const imageRequestPatterns = [
      /create (?:an|a) image/i,
      /generate (?:an|a) image/i,
      /make (?:an|a) image/i,
      /draw (?:an|a) image/i,
      /create (?:an|a) picture/i,
      /generate (?:an|a) picture/i,
      /make (?:an|a) picture/i,
      /draw (?:an|a) picture/i,
      /show me (?:an|a) image/i,
      /can you create (?:an|a) image/i,
      /create (?:an|a) dall-?e/i,
      /generate (?:an|a) dall-?e/i,
      /create (?:an|a) dall/i,
      /image of/i,
      /picture of/i,
      /visualization of/i
    ];

    const isImageRequest = imageRequestPatterns.some(pattern => pattern.test(userMessage));
    
    // If this appears to be an image request and we have an API key
    if (isImageRequest && column.apiKey) {
      try {
        // Add user message to chat history
        await storage.createChat({
          cardId,
          role: "user",
          content: userMessage
        });
        
        // Generate a clean prompt from the user message
        const promptMatch = userMessage.match(/(?:image|picture|drawing|visualization) (?:of|showing|with|that) (.+)/i) || 
                           userMessage.match(/(?:create|generate|make|draw) (?:an|a) (?:image|picture|drawing|visualization) (?:of|showing|with|that) (.+)/i);
        
        const prompt = promptMatch ? promptMatch[1].trim() : userMessage;
        
        // Generate the image
        const imageUrl = await generateImage(prompt, column.apiKey);
        
        if (!imageUrl) {
          throw new Error("Failed to generate image");
        }
        
        // Fetch the image and convert to base64
        const response = await fetch(imageUrl);
        const imageBuffer = await response.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        
        // Create a descriptive filename
        const safePrompt = prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `dalle_${safePrompt}_${Date.now()}.png`;
        
        // Create attachment
        const attachment = await storage.createAttachment({
          cardId,
          filename,
          fileType: 'image/png',
          content: base64Image
        });
        
        // Add a message from the assistant with the image
        // Use "Generated image" as the alt text for better compatibility with image renderer
        await storage.createChat({
          cardId,
          role: "assistant",
          content: `✨ Generated an image based on your request: "${prompt}"\n\n![Generated image](attachment:${attachment.id})`,
          gptName: column.gptName || "AI Assistant",
          gptColor: column.gptColor
        });
        
        return;
      } catch (error) {
        console.error("Error generating image:", error);
        // Continue with regular chat processing if image generation fails
      }
    }

    // Prepare the user message content (with images if available)
    let userContent: string | ChatCompletionContentPart[] = userMessage;
    
    // Check if we have image attachments to include
    if (card.attachments && card.attachments.length > 0) {
      const imageAttachments = card.attachments.filter(att => att.fileType.includes('image'));
      
      console.log(`======== CHAT IMAGE ANALYSIS ========`);
      console.log(`Card ${cardId} has ${card.attachments.length} attachments, ${imageAttachments.length} are images`);
      
      // If we have image attachments, format the content with text and images
      if (imageAttachments.length > 0) {
        // Update the system message to explicitly mention vision capabilities
        systemContent += "\n\nIMPORTANT: You have vision capabilities and CAN analyze images. Examine all images in detail and include your observations in responses. Images are not separate entities - they are part of this conversation and you can see them directly.";
        
        // Update the messages array with the enhanced system content
        messages[0].content = systemContent;
        
        userContent = createContentWithImages(userMessage, card.attachments);
        console.log(`Prepared chat message with ${imageAttachments.length} images for analysis`);
        
        // Log image names for debugging
        console.log(`Images included: ${imageAttachments.map(img => img.filename).join(', ')}`);
      } else {
        console.log(`No image attachments found despite having ${card.attachments.length} attachments`);
        console.log(`Attachment types: ${card.attachments.map(att => att.fileType).join(', ')}`);
      }
      console.log(`======== END CHAT IMAGE ANALYSIS ========`);
    }
    
    // Add the new user message (potentially with images)
    messages.push({
      role: "user",
      content: userContent
    });
    
    // Save the plain text message to the chat history
    await storage.createChat({
      cardId,
      role: "user",
      content: userMessage
    });

    console.log(`Sending message to OpenAI with model ${OPENAI_MODEL}, including ${typeof userContent === 'string' ? 0 : userContent.length - 1} images`);
    
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const response = completion.choices[0].message.content || "";

    // Save the assistant's response with GPT name and color
    await storage.createChat({
      cardId,
      role: "assistant",
      content: response,
      gptName: column.gptName || "AI Assistant",
      gptColor: column.gptColor
    });

    // Handle file generation if indicated in the response
    await handleFileGeneration(cardId, response);
    
    // Always update card to reset processing state, even if a chat modal has been closed
    await storage.updateCard(cardId, { processing: false });

  } catch (error) {
    console.error("Error processing chat with GPT:", error);
    
    // More informative error message
    const errorMessage = error instanceof Error 
      ? error.message
      : "Unknown error occurred while processing";
    
    // Check for rate limits or token limits specifically
    let userFriendlyError = errorMessage;
    if (errorMessage.includes("rate limit")) {
      userFriendlyError = "OpenAI API rate limit exceeded. Please try again in a few moments.";
    } else if (errorMessage.includes("maximum context length")) {
      userFriendlyError = "The chat history is too large for processing. Try starting a new card with shorter content.";
    } else if (errorMessage.includes("API key")) {
      userFriendlyError = "Invalid or missing OpenAI API key. Please update the API key in column settings.";
    }
    
    // Add user-friendly error message to chat with GPT name and color
    await storage.createChat({
      cardId,
      role: "assistant",
      content: `⚠️ Error: ${userFriendlyError}`,
      gptName: column.gptName || "AI Assistant",
      gptColor: column.gptColor
    });
    
    // Always reset the processing state on error, even if the chat modal has been closed
    try {
      // Store the error in the gptOutput field since there's no dedicated error field
      await storage.updateCard(cardId, { 
        processing: false
      });
      
      // Optionally update the output message to indicate an error
      await storage.updateCard(cardId, {
        gptOutput: `Error: ${userFriendlyError}`
      });
    } catch (updateError) {
      console.error("Error updating card processing state:", updateError);
    }

    throw error;
  }
}

/**
 * Handles file generation based on response content
 */
async function handleFileGeneration(cardId: number, response: string): Promise<void> {
  console.log(`=== FILE GENERATION START: Card ${cardId} ===`);
  let attachmentsCreated = 0;
  
  // Keep track of created CSV content hashes to prevent duplicates
  const processedHashes = new Set<string>();
  
  // Helper function to hash content and check for duplicates
  const createCSVIfUnique = async (content: string, filename: string): Promise<boolean> => {
    // Create a simple hash of the content to check for duplicates
    // We normalize whitespace to avoid treating similar CSVs as different
    const normalizedContent = content.trim().replace(/\s+/g, ' ');
    const contentHash = Buffer.from(normalizedContent).toString('base64');
    
    if (processedHashes.has(contentHash)) {
      console.log(`Skipping duplicate CSV content for ${filename} (already processed)`);
      return false;
    }
    
    // Store hash and create attachment
    processedHashes.add(contentHash);
    const success = await createCSVAttachmentFromText(cardId, content, filename);
    return success;
  };
  
  try {
    // First, try to extract CSV content using various patterns
    const csvContent = extractCSVContent(response);
    if (csvContent) {
      console.log(`Found CSV content using pattern: ${csvContent.format}`);
      const success = await createCSVIfUnique(csvContent.content, `data_${Date.now()}.csv`);
      if (success) {
        attachmentsCreated++;
      }
    }
    
    // Proceed with standard file attachment pattern
    const fileRegex = /```(?:file|attachment):([^,]+),\s*([^,]+),\s*([^`]+)```/g;
    let match;

    console.log(`Checking for file attachments with standard format`);
    while ((match = fileRegex.exec(response)) !== null) {
      try {
        const [_, filename, fileType, content] = match;
        
        // Special handling for CSV files to ensure content is properly formatted
        if (fileType.trim().includes('csv') || filename.trim().endsWith('.csv')) {
          console.log(`Handling CSV file with standard format: ${filename.trim()}`);
          
          // Use our helper for better CSV handling with duplicate detection
          const success = await createCSVIfUnique(content.trim(), filename.trim());
          if (success) {
            attachmentsCreated++;
          }
        } else {
          // Handle all other file types normally
          console.log(`Creating non-CSV attachment: ${filename.trim()} (${fileType.trim()})`);
          await storage.createAttachment({
            cardId,
            filename: filename.trim(),
            fileType: fileType.trim(),
            content: content.trim()
          });
          attachmentsCreated++;
        }
      } catch (error) {
        console.error("Error creating attachment:", error);
      }
    }
    
    // Also look for embedded CSV content in ```csv blocks
    const csvBlockRegex = /```csv\s*\n([\s\S]*?)\n```/gi;
    let csvMatch;
    while ((csvMatch = csvBlockRegex.exec(response)) !== null) {
      try {
        console.log(`Found CSV block, attempting to create attachment`);
        const csvContent = csvMatch[1].trim();
        const success = await createCSVIfUnique(csvContent, `data_${Date.now()}.csv`);
        if (success) {
          attachmentsCreated++;
        }
      } catch (error) {
        console.error("Error creating CSV attachment from code block:", error);
      }
    }
    
    // Look for the Monthly Average Spending format in plaintext
    if (response.includes("Monthly Average Spending")) {
      const lines = response.split('\n');
      const csvLines = [];
      let capturing = false;
      
      for (const line of lines) {
        if (line.includes("Monthly Average Spending")) {
          capturing = true;
          csvLines.push(line);
        } else if (capturing && line.trim().length > 0 && line.includes(',')) {
          csvLines.push(line);
        } else if (capturing && line.trim().length === 0) {
          // Empty line - stop capturing
          break;
        }
      }
      
      if (csvLines.length > 1) {
        console.log(`Found Monthly Average Spending format, extracted ${csvLines.length} lines`);
        const csvContent = csvLines.join('\n');
        const success = await createCSVIfUnique(csvContent, `monthly_average_spending_${Date.now()}.csv`);
        if (success) {
          attachmentsCreated++;
        }
      }
    }
    
    console.log(`=== FILE GENERATION END: Created ${attachmentsCreated} attachments ===`);
  } catch (error) {
    console.error("Error in file generation process:", error);
  }
}

/**
 * Generates an image with DALL-E based on prompt
 */
export async function generateImage(prompt: string, apiKey?: string): Promise<string> {
  try {
    const openai = getOpenAIClient(apiKey || undefined);
    
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    return response.data[0].url || "";
  } catch (error) {
    console.error("Error generating image with DALL-E:", error);
    throw error;
  }
}
