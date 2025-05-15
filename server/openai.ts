import OpenAI from "openai";
import { ChatCompletionContentPart, ChatCompletionMessageParam } from "openai/resources";
import { storage } from "./storage";
import { Column, Attachment, Chat } from "@shared/schema";
import { extractCSVContent, createCSVAttachmentFromText } from './csv-helper';
import { getTestPromptSuggestion, PromptSuggestion } from "./test-prompt-assistant";

// Export image request detection patterns for use in both server and client code
export const imageRequestPatterns = [
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
  /image of/i,
  /picture of/i,
  /visualization of/i,
  // Add more explicit patterns to ensure we catch all image generation requests
  /new image/i,
  /another image/i,
  /create image/i,
  /generate image/i
];

// Global settings key for the global prompt
const GLOBAL_PROMPT_SETTING_KEY = "global_prompt";

/**
 * Get the global prompt from settings
 * If it doesn't exist, initialize an empty one
 */
async function getGlobalPrompt(): Promise<string> {
  try {
    const setting = await storage.getSetting(GLOBAL_PROMPT_SETTING_KEY);
    if (setting && setting.value) {
      return setting.value.trim();
    } else {
      // Initialize the setting if it doesn't exist to prevent future errors
      await storage.createOrUpdateSetting(GLOBAL_PROMPT_SETTING_KEY, "");
      console.log("Initialized empty global prompt setting");
    }
  } catch (error) {
    console.error("Error fetching global prompt:", error);
    // Try to initialize the setting if an error occurred
    try {
      await storage.createOrUpdateSetting(GLOBAL_PROMPT_SETTING_KEY, "");
      console.log("Created empty global prompt setting after error");
    } catch (initError) {
      console.error("Failed to initialize global prompt setting:", initError);
    }
  }
  return ""; // Return empty string if no global prompt is set
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const OPENAI_MODEL = "gpt-4o"; // Using GPT-4o which has vision capabilities built in

// Initialize OpenAI client
export const getOpenAIClient = (apiKey?: string) => {
  // Special handling for "from_env" value or undefined apiKey
  console.log(`getOpenAIClient called with apiKey param: ${apiKey ? (apiKey === "from_env" ? "from_env" : "custom key provided") : "undefined"}`);
  
  try {
    // First, try to use a directly provided API key
    if (apiKey && apiKey !== "from_env") {
      console.log("Using custom API key from column settings");
      return new OpenAI({ apiKey: apiKey });
    }
    
    // Otherwise, use the environment variable
    console.log("Using environment variable for OpenAI API key");
    
    // Directly check if the environment variable is accessible
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY environment variable is not defined or empty");
      throw new Error("OpenAI API key not found in environment variables");
    }
    
    console.log(`Environment OPENAI_API_KEY available with length: ${process.env.OPENAI_API_KEY.length}`);
    
    // Create the client directly with the environment variable
    console.log("Creating new OpenAI client, using model: " + OPENAI_MODEL);
    
    // Use the direct approach that works in our test script
    return new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY
    });
  } catch (error) {
    console.error("Error creating OpenAI client:", error);
    throw error;
  }
};

/**
 * Cleans and validates a base64 string
 * 
 * This function performs the following:
 * - Trims leading/trailing whitespace
 * - Removes invalid base64 characters
 * - Ensures proper padding with '=' characters
 * - Checks for minimum valid length
 * 
 * @param base64String The base64 string to clean and validate
 * @returns A cleaned base64 string
 */
export const cleanBase64 = (base64String: string): string => {
  console.log(`[BASE64-CLEAN] Original string length: ${base64String.length}`);
  
  // Trim leading/trailing whitespace
  let cleaned = base64String.trim();
  
  // Remove any characters that are not valid base64 characters (A-Z, a-z, 0-9, +, /, =)
  const originalLength = cleaned.length;
  cleaned = cleaned.replace(/[^A-Za-z0-9+/=]/g, '');
  console.log(`[BASE64-CLEAN] Removed ${originalLength - cleaned.length} invalid characters`);
  
  // Ensure the string length is a multiple of 4 by adding padding (=)
  while (cleaned.length % 4 !== 0) {
    cleaned += '=';
  }
  
  console.log(`[BASE64-CLEAN] Final string length: ${cleaned.length}`);
  
  // Minimum length check (arbitrarily set to 20 chars as an example)
  if (cleaned.length < 20) {
    console.warn(`[BASE64-CLEAN] Warning: Very short base64 string (${cleaned.length} chars), may be invalid`);
  }
  
  // Log a snippet of the cleaned string for debugging
  console.log(`[BASE64-CLEAN] First 20 chars of cleaned string: ${cleaned.substring(0, 20)}...`);
  
  return cleaned;
};

/**
 * Infers MIME type from a Buffer by checking file signatures (magic bytes)
 * 
 * This function examines the initial bytes of a buffer to determine the file type
 * by matching against known file signatures.
 * 
 * @param buffer A Node.js Buffer containing the file data
 * @returns The MIME type string or null if not recognized
 */
export const inferMimeTypeFromBuffer = (buffer: Buffer): string | null => {
  // Check if buffer is too small to contain a signature
  if (!buffer || buffer.length < 4) {
    console.log(`[MIME-INFER] Buffer too small (${buffer?.length || 0} bytes) to contain a signature`);
    return null;
  }
  
  console.log(`[MIME-INFER] Checking file signature for buffer of length ${buffer.length} bytes`);
  
  // Check for PNG signature: 89 50 4E 47 (hex) or [137, 80, 78, 71] (decimal)
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    console.log(`[MIME-INFER] Detected PNG signature`);
    return 'image/png';
  }
  
  // Check for JPEG signature: FF D8 FF (hex) or [255, 216, 255] (decimal)
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    console.log(`[MIME-INFER] Detected JPEG signature`);
    return 'image/jpeg';
  }
  
  // Check for GIF signatures: 
  // GIF87a: 47 49 46 38 37 61 (hex) or [71, 73, 70, 56, 55, 97] (decimal)
  // GIF89a: 47 49 46 38 39 61 (hex) or [71, 73, 70, 56, 57, 97] (decimal)
  if (buffer.length >= 6 && 
      buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && 
      buffer[3] === 0x38 && 
      (buffer[4] === 0x37 || buffer[4] === 0x39) && 
      buffer[5] === 0x61) {
    console.log(`[MIME-INFER] Detected GIF signature (${buffer[4] === 0x37 ? '87a' : '89a'})`);
    return 'image/gif';
  }
  
  // Check for WebP signature
  // WebP has RIFF header (52 49 46 46) followed by "WEBP" at offset 8 (57 45 42 50)
  if (buffer.length >= 12 && 
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    console.log(`[MIME-INFER] Detected WebP signature`);
    return 'image/webp';
  }
  
  // No known signature found
  console.log(`[MIME-INFER] No known image signature detected`);
  return null;
};

// Helper function to convert base64 image to data URL for OpenAI vision API
const base64ToDataURL = (base64: string, mimeType: string): string => {
  // Remove any existing 'data:' prefixes if they exist
  let rawBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
  
  // Clean the base64 data using our helper function
  const cleanedBase64 = cleanBase64(rawBase64);
  
  // Ensure valid MIME type format
  const validMimeType = mimeType.includes('/') ? mimeType : `image/${mimeType}`;
  
  // Return properly formatted data URL
  return `data:${validMimeType};base64,${cleanedBase64}`;
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
    
    // Add global prompt if available
    const globalPrompt = await getGlobalPrompt();
    if (globalPrompt) {
      prompt += `${globalPrompt}\n\n`;
    }
    
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

    // For card processing in a new column, include previous chat history if enabled with includeChatHistory
    // When moving between columns, includeChatHistory controls whether to bring the history
    if (card.chats && card.chats.length > 0) {
      // If the card has been moved to a new column, respect the includeChatHistory flag
      // Otherwise, always include the chat history for the current column
      if (card.includeChatHistory) {
        console.log(`Including ${card.chats.length} previous chat messages in card processing`);
        prompt += "Previous conversations:\n";
        for (const chat of card.chats) {
          prompt += `${chat.role === 'assistant' ? 'AI' : 'User'}: ${chat.content}\n`;
        }
        prompt += "\n";
      } else {
        console.log(`Chat history exists but not included (includeChatHistory is disabled)`);
      }
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
    
    // Create a chat message with the error
    await storage.createChat({
      cardId,
      role: "assistant",
      content: `⚠️ Error: ${userFriendlyError}`,
      gptName: "System",
      gptColor: "red"
    });
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
    
    // Get global prompt if available
    const globalPrompt = await getGlobalPrompt();
    let systemContent = `You are ${column.gptName || "an AI assistant"}. `;
    
    // Add global prompt if available
    if (globalPrompt) {
      systemContent += `${globalPrompt}\n\n`;
    }
    
    // Add column-specific instructions if available
    if (column.gptInstructions) {
      systemContent += `${column.gptInstructions}\n\n`;
    }
    
    systemContent += `You are continuing a conversation about a card in a Kanban board. The card details are:\n`;
    systemContent += `Card Title: ${card.title}\n`;
    systemContent += `Card Description: ${card.description || "No description provided."}\n\n`;

    // Include the card's existing GPT output if it exists
    if (card.gptOutput) {
      systemContent += `Your Previous Analysis: ${card.gptOutput}\n\n`;
    }
    
    // Include information about attachments if any
    if (card.attachments && card.attachments.length > 0) {
      systemContent += "The card has the following attached files:\n";
      for (const attachment of card.attachments) {
        systemContent += `- ${attachment.filename} (${attachment.fileType})\n`;
      }
      systemContent += "\n";
    }
    
    systemContent += "Please be helpful, detailed, and respond directly to the user's message.";
    
    // Create the messages array
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent }
    ];

    // Always include chat history for conversations in the same column
    // The includeChatHistory flag only controls whether to include history when a card is moved to a new column
    if (card.chats && card.chats.length > 0) {
      console.log(`Including ${card.chats.length} previous chat messages in conversation history`);
      for (const chat of card.chats) {
        messages.push({
          role: chat.role as "user" | "assistant",
          content: chat.content
        });
      }
    }

    // Image generation detection 
    // Using the exported patterns array defined at the top of this file
    const isImageRequest = imageRequestPatterns.some(pattern => pattern.test(userMessage));
    
    // Force image generation mode for special cases
    const forceImageGeneration = 
      userMessage.toLowerCase().includes("force image generation") || 
      userMessage.toLowerCase().includes("ignore existing images") ||
      userMessage.toLowerCase().includes("create new image");
    
    // Handle image generation requests
    if (isImageRequest || forceImageGeneration) {
      console.log(`[IMAGE-HANDLING] Image generation request detected in message: "${userMessage}"`);
      console.log(`[IMAGE-HANDLING] Force generation mode: ${forceImageGeneration ? 'ON' : 'OFF'}`);
      
      try {
        // Extract the image generation prompt from the user message
        let imagePrompt = userMessage;
        
        // Try to extract the actual prompt by removing common prefix patterns
        for (const pattern of [
          /^create (?:an?|the) image (?:of|for|showing|with|based on)\s*/i,
          /^generate (?:an?|the) image (?:of|for|showing|with|based on)\s*/i,
          /^make (?:an?|the) image (?:of|for|showing|with|based on)\s*/i,
          /^draw (?:an?|the) image (?:of|for|showing|with|based on)\s*/i,
          /^create (?:an?|the) picture (?:of|for|showing|with|based on)\s*/i,
          /^generate (?:an?|the) picture (?:of|for|showing|with|based on)\s*/i,
          /^make (?:an?|the) picture (?:of|for|showing|with|based on)\s*/i,
          /^draw (?:an?|the) picture (?:of|for|showing|with|based on)\s*/i,
          /^show me (?:an?|the) image (?:of|for|showing|with|based on)\s*/i,
          /^can you create (?:an?|the) image (?:of|for|showing|with|based on)\s*/i,
          /^image of\s*/i,
          /^picture of\s*/i,
          /^visualization of\s*/i
        ]) {
          if (pattern.test(imagePrompt)) {
            imagePrompt = imagePrompt.replace(pattern, '');
            break;
          }
        }

        console.log(`[IMAGE-HANDLING] Extracted image prompt: "${imagePrompt}"`);
        
        // Add a chat message to indicate that the image is being generated
        await storage.createChat({
          cardId,
          role: "assistant",
          content: `🎨 Generating an image based on your request... This might take a moment.`,
          gptName: column.gptName || "AI Assistant",
          gptColor: column.gptColor
        });
        
        // Create a timeout safety mechanism to ensure the card doesn't stay in processing state
        const processingTimeout = setTimeout(async () => {
          try {
            console.log(`[IMAGE-HANDLING] Processing timeout reached for card ${cardId}. Checking status...`);
            const card = await storage.getCardById(cardId);
            if (card && card.processing) {
              console.log(`[IMAGE-HANDLING] Card ${cardId} is still in processing state after timeout. Resetting flag.`);
              await storage.updateCard(cardId, { processing: false });
              
              // Notify the user about the timeout
              await storage.createChat({
                cardId,
                role: "assistant",
                content: `⚠️ Image generation is taking longer than expected. Please try again or use a simpler prompt.`,
                gptName: column.gptName || "AI Assistant",
                gptColor: column.gptColor
              });
            }
          } catch (timeoutError) {
            console.error(`[IMAGE-HANDLING] Error during timeout handling:`, timeoutError);
          }
        }, 180000); // 3 minutes timeout
        
        try {
          // Call the generateImage function with the extracted prompt
          console.log(`[IMAGE-HANDLING] Calling generateImage with prompt: "${imagePrompt}"`);
          // Use gpt-image-1 model with size 1024x1024 and medium quality
          const imageResult = await generateImage(
            imagePrompt, 
            column.apiKey || undefined,
            "1024x1024", // Size parameter
            "gpt-image-1", // Model parameter
            "medium" // Quality parameter
          );
          console.log(`[IMAGE-HANDLING] Image generation successful, received base64 data of length: ${imageResult.base64.length}`);
          
          // Clear the timeout since we got a successful response
          clearTimeout(processingTimeout);
          
          // Process the generated image with handleFileGeneration
          console.log(`[IMAGE-HANDLING] Calling handleFileGeneration to process and save the image`);
          await handleFileGeneration(cardId, userMessage, {
            base64: imageResult.base64,
            fileType: imageResult.fileType
          });
          console.log(`[IMAGE-HANDLING] Image processing and saving completed successfully`);
        } catch (error) {
          // Clear the timeout since we're handling the error already
          clearTimeout(processingTimeout);
          throw error; // Re-throw to be caught by the outer try/catch block
        }
        
      } catch (error) {
        console.error(`[IMAGE-HANDLING] Error during image generation:`, error);
        
        // Create error message for the user
        let errorMessage = "I couldn't generate that image due to a technical issue. Please try again later.";
        if (error instanceof Error) {
          console.error(`[IMAGE-HANDLING] Error details: ${error.message}`);
          
          // Add more specific error details based on the type of error
          if (error.message.includes("content policy") || 
              error.message.includes("safety") || 
              error.message.includes("violates")) {
            errorMessage = "I couldn't generate that image because it may violate content safety policies. Please try a different prompt that doesn't include sensitive content.";
          } else if (error.message.includes("API key") || 
                    error.message.includes("authentication") ||
                    error.message.includes("unauthorized")) {
            errorMessage = "I couldn't generate the image due to an API authentication error. The API key may be invalid or missing.";
          } else if (error.message.includes("timeout") || 
                    error.message.includes("timed out") ||
                    error.message.includes("429") ||
                    error.message.includes("rate limit")) {
            errorMessage = "The image generation service is currently busy. Please try again in a few moments or with a simpler prompt.";
          } else if (error.message.includes("format") ||
                    error.message.includes("parsing") ||
                    error.message.includes("invalid")) {
            errorMessage = "There was an issue with the image format. Please try a different prompt or request.";
          }
        }
        
        // Log the user-friendly error message
        console.log(`[IMAGE-HANDLING] Sending user-friendly error message: ${errorMessage}`);
        
        // Send the error message to the user
        await storage.createChat({
          cardId,
          role: "assistant",
          content: `⚠️ ${errorMessage}`,
          gptName: column.gptName || "AI Assistant",
          gptColor: column.gptColor
        });
      } finally {
        // Always mark the card as not processing, regardless of success or failure
        await storage.updateCard(cardId, { processing: false });
      }
      
      // Return early, as we've handled the image generation request
      return;
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
        systemContent += "\n\nIMPORTANT: You have vision capabilities and MUST analyze all images in your messages. These images are directly visible to you. Pay special attention to the details in these images and include your observations in your response.";
        
        // Update the messages array with the enhanced system content
        messages[0].content = systemContent;
        
        // Create complex content with text + images for the user message
        userContent = createContentWithImages(userMessage, card.attachments);
        console.log(`Created complex user message with ${imageAttachments.length} images`);
      } else {
        console.log(`No image attachments found despite having ${card.attachments.length} attachments`);
        console.log(`Attachment types: ${card.attachments.map(att => att.fileType).join(', ')}`);
      }
      console.log(`======== END CHAT IMAGE ANALYSIS ========`);
    }
    
    // Add the user message to the conversation
    // This will be either a string or a ContentPart array with images
    messages.push({ 
      role: "user", 
      content: userContent 
    });
    
    console.log(`Sending chat to OpenAI with model ${OPENAI_MODEL}, including ${typeof userContent === 'string' ? 0 : userContent.length - 1} images`);
    
    // Log the exact model we're using to catch any overrides
    console.log(`Using OpenAI model: ${OPENAI_MODEL}`);
    
    // Call OpenAI API with explicit model
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL, // gpt-4o has vision and all capabilities
      messages,
      temperature: 0.7, // Default creative temperature
      max_tokens: 2000, // Generous response length
    });
    
    const response = completion.choices[0].message.content || "";
    console.log(`Response received, length: ${response.length} characters`);
    
    // Create a chat message with the response
    await storage.createChat({
      cardId,
      role: "assistant",
      content: response,
      gptName: column.gptName || "AI Assistant",
      gptColor: column.gptColor
    });
    
    // Handle file generation from content if the model output contains file syntax
    await handleFileGeneration(cardId, response);
    
    // Always update card to reset processing state, even if a chat modal has been closed
    await storage.updateCard(cardId, { processing: false });
    
  } catch (error) {
    console.error("Error processing chat with GPT:", error);
    
    // Create more informative error message
    const errorMessage = error instanceof Error 
      ? error.message
      : "Unknown error occurred";
    
    // Check for specific API errors
    let userFriendlyError = errorMessage;
    if (errorMessage.includes("rate limit")) {
      userFriendlyError = "OpenAI API rate limit exceeded. Please try again in a few moments.";
    } else if (errorMessage.includes("maximum context length")) {
      userFriendlyError = "The chat history is too large for processing. Try starting a new card with shorter content.";
    } else if (errorMessage.includes("API key")) {
      userFriendlyError = "Invalid or missing OpenAI API key. Please update the API key in column settings.";
    }
    
    try {
      // Add error message to chat
      await storage.createChat({
        cardId,
        role: "assistant",
        content: `⚠️ Error: ${userFriendlyError}`,
        gptName: "System",
        gptColor: "red"
      });
    } catch (updateError) {
      console.error("Error adding error message to chat:", updateError);
    }
    
    // Always reset the processing state on error, even if the chat modal has been closed
    await storage.updateCard(cardId, { processing: false });
  }
}

/**
 * Handle file generation from GPT responses
 * Looks for patterns like ```file:filename.ext,content```
 */
/**
 * Handles file generation from GPT responses, including images and CSVs
 * 
 * @param cardId - The ID of the card to attach the generated file to
 * @param response - The text response from GPT that might contain file syntax
 * @param imageData - Optional object containing image data (base64 or URL)
 * @returns Promise resolving when all file generation is complete
 */
export async function handleFileGeneration(
  cardId: number, 
  response: string, 
  imageData?: { base64?: string, url?: string, fileType?: string }
): Promise<void> {
  console.log(`=== FILE GENERATION START: Card ${cardId} ===`);
  let attachmentsCreated = 0;
  
  // Keep track of created CSV content hashes to prevent duplicates
  const processedHashes = new Set<string>();
  
  try {
    // Process image data if provided
    if (imageData) {
      console.log(`=== IMAGE PROCESSING START: Card ${cardId} ===`);
      
      try {
        let content = '';
        let fileType = '';
        let originalPrompt = 'image request';
        
        // Extract the prompt from the response if available
        const promptMatch = response.match(/generate(?:d)? (?:an? )?image (?:of |for |based on )?"([^"]+)"/i);
        if (promptMatch && promptMatch[1]) {
          originalPrompt = promptMatch[1];
          console.log(`[IMAGE-PROCESS] Extracted original prompt: "${originalPrompt}"`);
        }
        
        // Handle base64-encoded image data from gpt-image-1
        if (imageData.base64) {
          console.log(`[IMAGE-PROCESS] Processing base64-encoded image data with length: ${imageData.base64.length}`);
          
          // Clean and validate the base64 data
          const cleanedBase64 = cleanBase64(imageData.base64);
          console.log(`[IMAGE-PROCESS] Cleaned base64 data, new length: ${cleanedBase64.length}`);
          
          // Convert base64 to buffer for MIME type detection
          const buffer = Buffer.from(cleanedBase64, 'base64');
          console.log(`[IMAGE-PROCESS] Converted base64 to buffer with size: ${buffer.length} bytes`);
          
          // Determine the file type using the inferMimeTypeFromBuffer helper
          const inferredType = inferMimeTypeFromBuffer(buffer);
          
          if (inferredType) {
            fileType = inferredType;
            console.log(`[IMAGE-PROCESS] Using inferred MIME type: ${fileType}`);
          } else if (imageData.fileType) {
            fileType = imageData.fileType;
            console.log(`[IMAGE-PROCESS] Using provided MIME type: ${fileType}`);
          } else {
            fileType = 'image/png'; // Default to PNG
            console.log(`[IMAGE-PROCESS] Using default MIME type: ${fileType}`);
          }
          
          content = cleanedBase64;
        }
        // Handle URL-based image data from DALL-E 3 fallback
        else if (imageData.url) {
          console.log(`[IMAGE-PROCESS] Processing image URL: ${imageData.url}`);
          
          try {
            // Fetch image data from URL with retry logic
            const fetch = await import('node-fetch');
            let response = null;
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
              try {
                console.log(`[IMAGE-PROCESS] Fetching image, attempt ${retryCount + 1}/${maxRetries}`);
                response = await fetch.default(imageData.url);
                
                if (response.ok) {
                  break;
                } else {
                  console.log(`[IMAGE-PROCESS] Fetch failed with status: ${response.status}`);
                  retryCount++;
                  if (retryCount < maxRetries) {
                    const delay = 1000 * retryCount; // Increasing delay between retries
                    console.log(`[IMAGE-PROCESS] Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                  }
                }
              } catch (error) {
                console.error(`[IMAGE-PROCESS] Fetch attempt ${retryCount + 1} failed:`, error);
                retryCount++;
                if (retryCount < maxRetries) {
                  const delay = 1000 * retryCount;
                  console.log(`[IMAGE-PROCESS] Retrying in ${delay}ms...`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                }
              }
            }
            
            if (!response || !response.ok) {
              throw new Error(`Failed to fetch image after ${maxRetries} attempts`);
            }
            
            // Get the content type from the response headers if available
            const contentType = response.headers.get('content-type');
            console.log(`[IMAGE-PROCESS] Content-Type from response: ${contentType || 'not available'}`);
            
            // Get the image data as array buffer
            const imageBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(imageBuffer);
            console.log(`[IMAGE-PROCESS] Downloaded image, size: ${buffer.length} bytes`);
            
            // Determine the file type
            // First try to use the Content-Type header
            if (contentType && contentType.startsWith('image/')) {
              fileType = contentType;
              console.log(`[IMAGE-PROCESS] Using Content-Type header for MIME type: ${fileType}`);
            } else {
              // Otherwise, try to infer from buffer
              const inferredType = inferMimeTypeFromBuffer(buffer);
              
              if (inferredType) {
                fileType = inferredType;
                console.log(`[IMAGE-PROCESS] Using inferred MIME type: ${fileType}`);
              } else if (imageData.fileType) {
                fileType = imageData.fileType;
                console.log(`[IMAGE-PROCESS] Using provided MIME type: ${fileType}`);
              } else {
                fileType = 'image/png'; // Default to PNG
                console.log(`[IMAGE-PROCESS] Using default MIME type: ${fileType}`);
              }
            }
            
            // Convert buffer to base64
            const rawBase64 = buffer.toString('base64');
            console.log(`[IMAGE-PROCESS] Converted image to base64, length: ${rawBase64.length}`);
            
            // Clean the base64 data
            content = cleanBase64(rawBase64);
            console.log(`[IMAGE-PROCESS] Cleaned base64 data, final length: ${content.length}`);
            
          } catch (error) {
            const fetchError = error as Error;
            console.error(`[IMAGE-PROCESS] Error fetching image from URL:`, fetchError);
            throw new Error(`Failed to fetch image: ${fetchError.message}`);
          }
        } else {
          console.warn(`[IMAGE-PROCESS] No base64 or URL provided in imageData, skipping image processing`);
          throw new Error('Missing required image data (base64 or URL)');
        }
        
        if (!content || !fileType) {
          console.error(`[IMAGE-PROCESS] Missing content or fileType after processing`);
          throw new Error('Failed to process image data properly');
        }
        
        // Generate a descriptive filename
        const modelPart = imageData.url ? 'dalle' : 'gpt-image';
        const promptPart = originalPrompt
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .replace(/_+/g, '_')
          .substring(0, 30);
        const timestamp = Date.now();
        let extension = fileType.split('/')[1] || 'png';
        
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
          
          console.log(`[IMAGE-PROCESS] Using image extension: ${extension} for MIME type: ${fileType}`);
        } else {
          console.log(`[IMAGE-PROCESS] Using default extension: ${extension} for MIME type: ${fileType}`);
        }
        
        const filename = `${modelPart}_${promptPart}_${timestamp}.${extension}`;
        console.log(`[IMAGE-PROCESS] Generated filename: ${filename}`);
        
        // Create attachment in the database
        console.log(`[IMAGE-PROCESS] Creating attachment: cardId=${cardId}, fileType=${fileType}, filename=${filename}, content length=${content.length}`);
        const attachment = await storage.createAttachment({
          cardId,
          filename,
          fileType,
          content
        });
        
        console.log(`[IMAGE-PROCESS] Successfully created image attachment with ID: ${attachment.id}, filename: ${filename}, fileType: ${fileType}, content length: ${content.length}`);
        attachmentsCreated++;
        
        // Create a confirmation chat message with baseline values
        const chatMessage: {
          cardId: number;
          role: string;
          content: string;
          gptName?: string;
          gptColor?: string;
        } = {
          cardId,
          role: "assistant",
          content: `✨ Generated an image based on your request: "${originalPrompt}".\n\n![Generated image](/api/attachments/${attachment.id})`
        };
        
        // Add the column's GPT name and color if available
        try {
          // Get the card to find its column ID
          const card = await storage.getCardById(cardId);
          if (card) {
            const column = await storage.getColumnById(card.columnId);
            if (column) {
              // Only set these properties if they have non-empty values
              if (column.gptName) {
                chatMessage.gptName = column.gptName;
              }
              if (column.gptColor) {
                chatMessage.gptColor = column.gptColor;
              }
            }
          }
        } catch (columnError) {
          console.warn(`[IMAGE-PROCESS] Error getting column details:`, columnError);
        }
        
        // Create the confirmation chat message
        await storage.createChat(chatMessage);
        console.log(`[IMAGE-PROCESS] Created confirmation chat message for image generation`);
        
      } catch (imageError) {
        console.error(`[IMAGE-PROCESS] Error processing image:`, imageError);
      }
      
      console.log(`=== IMAGE PROCESSING END ===`);
    }
    
    // Function to create CSV attachment and track for uniqueness
    const createCSVIfUnique = async (content: string, filename: string): Promise<boolean> => {
      // Create a simple hash of the content to check for duplicates
      const contentHash = content.replace(/\s+/g, '').substring(0, 100);
      if (processedHashes.has(contentHash)) {
        console.log(`Skipping duplicate CSV content for ${filename}`);
        return false;
      }
      
      processedHashes.add(contentHash);
      await createCSVAttachmentFromText(cardId, content, filename);
      return true;
    };
    
    // Check for code blocks with file syntax
    const filePattern = /```file:([^,]+),([^,]+),?([\s\S]*?)```/g;
    let match;
    
    while ((match = filePattern.exec(response)) !== null) {
      try {
        const filename = match[1].trim();
        const mimeType = match[2].trim();
        const content = match[3].trim();
        
        console.log(`Detected file syntax for: ${filename} (${mimeType})`);
        
        // Only process CSV files for now
        if (mimeType.includes('csv') || filename.endsWith('.csv')) {
          console.log(`Creating CSV attachment from file syntax: ${filename}`);
          const success = await createCSVIfUnique(content, filename);
          if (success) {
            attachmentsCreated++;
          }
        } else {
          console.log(`Skipping non-CSV file type: ${mimeType}`);
        }
      } catch (error) {
        console.error("Error creating attachment from file syntax:", error);
      }
    }
    
    // Check for code blocks with CSV content (without file syntax)
    const codeBlocks = response.match(/```(?:csv)?\s*\n([\s\S]*?)```/g);
    if (codeBlocks) {
      console.log(`Found ${codeBlocks.length} potential CSV code blocks`);
      
      for (const block of codeBlocks) {
        try {
          // Extract just the content from within the code block
          const csvContent = block.replace(/```(?:csv)?\s*\n/, '').replace(/\s*```$/, '').trim();
          
          // Only process if it looks like CSV (contains commas and line breaks)
          if (csvContent.includes(',') && csvContent.includes('\n') && csvContent.length > 20) {
            console.log(`Creating CSV attachment from code block, length: ${csvContent.length}`);
            const success = await createCSVIfUnique(csvContent, `data_${Date.now()}.csv`);
            if (success) {
              attachmentsCreated++;
            }
          }
        } catch (error) {
          console.error("Error creating CSV attachment from code block:", error);
        }
      }
    }
    
    // Only check for CSV content if we're not handling an image request
    // This prevents incorrectly creating CSV files when processing image generation responses
    if (!imageData) {
      // Check for extracted CSV content from the response
      const csvResult = extractCSVContent(response);
      if (csvResult) {
        try {
          console.log(`Creating CSV attachment from extracted content, format: ${csvResult.format}`);
          const success = await createCSVIfUnique(csvResult.content, `${csvResult.format}_${Date.now()}.csv`);
          if (success) {
            attachmentsCreated++;
          }
        } catch (error) {
          console.error("Error creating CSV attachment from extracted content:", error);
        }
      }
    } else {
      console.log(`[IMAGE-PROCESS] Skipping CSV extraction for image generation response`);
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
 * Generates an image using OpenAI's image generation models
 * This implementation tries gpt-image-1 first, then falls back to dall-e-3 if needed
 * 
 * @param prompt Text prompt to generate the image from
 * @param apiKey Optional API key, if not provided will use environment variable
 * @param size Optional size parameter, defaults to 1024x1024
 * @returns Object containing base64 image data and file type
 */
/**
 * Generate images using OpenAI APIs (gpt-image-1 or dall-e-3)
 * 
 * @param prompt The text prompt to generate an image from
 * @param apiKey Optional API key to use instead of environment variable
 * @param size The image size to generate (1024x1024 is the default)
 * @param model Optional model selection: "gpt-image-1" (new), "dall-e-3" (default), or "auto" (tries gpt-image-1 first, falls back to dall-e-3)
 * @param quality Optional quality level for gpt-image-1: "low", "medium", "high", or "auto"
 * @returns Object containing the base64 image data, fileType and the model used
 */
export async function generateImage(
  prompt: string, 
  apiKey?: string, 
  size: "1024x1024" | "1792x1024" | "1024x1792" | "1536x1024" | "1024x1536" = "1024x1024",
  model: "gpt-image-1" | "dall-e-3" | "auto" = "auto",
  quality: "low" | "medium" | "high" | "auto" = "auto"
): Promise<{ base64: string, fileType: string, model: string }> {
  // Add stack trace logging to see where this function is being called from
  const stackTrace = new Error().stack;
  console.log(`[IMAGE-GEN] CALL STACK: generateImage called from:\n${stackTrace}`);
  
  console.log(`[IMAGE-GEN] Starting image generation with prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
  console.log(`[IMAGE-GEN] API key source: ${apiKey ? 'custom key provided' : 'using environment variable'}`);
  console.log(`[IMAGE-GEN] Selected model: ${model}`);
  
  // Debug environment variable to confirm the OpenAI API key is available
  const apiKeyEnv = process.env.OPENAI_API_KEY || 'not found';
  console.log(`[IMAGE-GEN] API key environment status: ${apiKeyEnv ? `available (length: ${apiKeyEnv.length})` : 'not set'}`);
  
  // Determine whether to use DALL-E 3 directly or try gpt-image-1 first
  // This allows us to implement a system preference (e.g. PREFER_DALLE_FALLBACK env var)
  const preferDalleFallback = process.env.PREFER_DALLE_FALLBACK === 'true';
  const actualModel = model === 'auto' 
    ? (preferDalleFallback ? 'dall-e-3' : 'gpt-image-1') 
    : model;
  
  console.log(`[IMAGE-GEN] Effective model selection: ${actualModel} (auto-selection: ${model === 'auto' ? 'enabled' : 'disabled'}, prefer DALL-E fallback: ${preferDalleFallback})`);
  
  // Initialize OpenAI client 
  console.log('[IMAGE-GEN] About to initialize OpenAI client');
  const openai = getOpenAIClient(apiKey);

  // Try the first model (either gpt-image-1 or dall-e-3 based on selection)
  try {
    if (actualModel === 'gpt-image-1') {
      // Try the newer gpt-image-1 model first
      console.log(`[IMAGE-GEN] Using gpt-image-1 model for image generation`);
      console.log(`[IMAGE-GEN] Parameters: model=gpt-image-1, quality=${quality}, size=${size}`);
      
      // Mark the start time to measure API response time
      const startTime = Date.now();
      console.log(`[IMAGE-GEN] Starting API call at: ${new Date().toISOString()}`);
      
      // Prepare parameters for the API call
      const imagenParams: any = {
        model: "gpt-image-1",
        prompt: prompt,
        n: 1,
        size: size
        // Note: gpt-image-1 does NOT support the response_format parameter
      };
      
      // Only add quality if it's not auto
      if (quality !== "auto") {
        imagenParams.quality = quality;
      }
      
      console.log(`[IMAGE-GEN] Full API parameters for gpt-image-1: ${JSON.stringify(imagenParams)}`);
      
      // Call OpenAI API with gpt-image-1 model with response_format=b64_json
      const imagenResult = await openai.images.generate(imagenParams);
      
      // Calculate response time
      const endTime = Date.now();
      const responseTime = (endTime - startTime) / 1000;
      console.log(`[IMAGE-GEN] API response received after ${responseTime.toFixed(2)} seconds`);
      
      // Log more details about the response structure
      console.log(`[IMAGE-GEN] API response structure: ${JSON.stringify(Object.keys(imagenResult))}`);
      console.log(`[IMAGE-GEN] Response data type: ${typeof imagenResult.data}`);
      console.log(`[IMAGE-GEN] Response data length: ${Array.isArray(imagenResult.data) ? imagenResult.data.length : 'not an array'}`);
      
      console.log(`[IMAGE-GEN] API call to gpt-image-1 successful`);
      
      // gpt-image-1 will return a URL instead of base64 data when response_format isn't specified
      console.log(`[IMAGE-GEN] Response structure keys: ${JSON.stringify(Object.keys(imagenResult))}`);
      
      // Check if we have data in the response
      if (!imagenResult?.data || !Array.isArray(imagenResult.data) || imagenResult.data.length === 0) {
        throw new Error("No image data returned from API");
      }
      
      // For gpt-image-1, we'll get base64 data directly with response_format=b64_json
      console.log(`[IMAGE-GEN] Full Imagen result data structure: ${JSON.stringify(Object.keys(imagenResult))}`);
      console.log(`[IMAGE-GEN] Imagen result data structure: ${typeof imagenResult.data} with length ${Array.isArray(imagenResult.data) ? imagenResult.data.length : 'not an array'}`);
      
      if (!imagenResult?.data || !Array.isArray(imagenResult.data) || imagenResult.data.length === 0) {
        throw new Error("No image data returned from API");
      }
      
      // Access the first item in the data array
      const imageData = imagenResult.data[0];
      console.log(`[IMAGE-GEN] Image data keys: ${JSON.stringify(Object.keys(imageData))}`);
      
      // Check for base64 data first (DALL-E 3 style)
      let base64Data: string;
      if (imageData.b64_json) {
        console.log(`[IMAGE-GEN] Found base64 data in response from gpt-image-1`);
        base64Data = imageData.b64_json;
      } 
      // If no base64, check for URL (expected for gpt-image-1)
      else if (imageData.url) {
        console.log(`[IMAGE-GEN] Found image URL in response: ${imageData.url}`);
        
        // We need to fetch the image and convert it to base64
        const fetch = await import('node-fetch');
        const response = await fetch.default(imageData.url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        base64Data = buffer.toString('base64');
      } 
      // No usable data in response
      else {
        throw new Error("Neither base64 data nor URL found in API response. Data keys: " + JSON.stringify(Object.keys(imageData)));
      }
      
      console.log(`[IMAGE-GEN] Successfully retrieved base64 data with length: ${base64Data.length}`);
      
      // Clean the base64 data
      const cleanedBase64 = cleanBase64(base64Data);
      
      // Try to infer MIME type from base64 data
      let mimeType = 'image/png'; // Default MIME type
      try {
        // Decode a small portion of the base64 to check the file signature
        const buffer = Buffer.from(cleanedBase64.substring(0, 100), 'base64');
        const inferredType = inferMimeTypeFromBuffer(buffer);
        
        if (inferredType) {
          console.log(`[IMAGE-GEN] Using inferred MIME type: ${inferredType}`);
          mimeType = inferredType;
        } else {
          console.log(`[IMAGE-GEN] Could not infer MIME type, using default: ${mimeType}`);
        }
      } catch (inferError) {
        console.error(`[IMAGE-GEN] Error inferring MIME type:`, inferError);
      }
      
      // Return the cleaned base64 data and inferred or default file type
      return { 
        base64: cleanedBase64, 
        fileType: mimeType,
        model: "gpt-image-1"
      };
    } else {
      // Use DALL-E 3 model directly
      console.log(`[IMAGE-GEN] Using dall-e-3 model for image generation`);
      console.log(`[IMAGE-GEN] Parameters: model=dall-e-3, response_format=b64_json, n=1, size=${size}`);
      
      // Mark the start time to measure API response time
      const startTime = Date.now();
      console.log(`[IMAGE-GEN] Starting API call at: ${new Date().toISOString()}`);
      
      // Call OpenAI API with dall-e-3 model
      const dalleResult = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: size as "1024x1024" | "1792x1024" | "1024x1792" | "1536x1024" | "1024x1536",
        response_format: "b64_json"
      });
      
      // Calculate response time
      const endTime = Date.now();
      const responseTime = (endTime - startTime) / 1000;
      console.log(`[IMAGE-GEN] API response received after ${responseTime.toFixed(2)} seconds`);
      
      // Log more details about the response structure
      console.log(`[IMAGE-GEN] API response structure: ${JSON.stringify(Object.keys(dalleResult))}`);
      console.log(`[IMAGE-GEN] Response data type: ${typeof dalleResult.data}`);
      console.log(`[IMAGE-GEN] Response data length: ${Array.isArray(dalleResult.data) ? dalleResult.data.length : 'not an array'}`);
      
      console.log(`[IMAGE-GEN] API call to dall-e-3 successful`);
      
      // Check if we have data in the response
      if (!dalleResult?.data || !Array.isArray(dalleResult.data) || dalleResult.data.length === 0) {
        throw new Error("No image data returned from API");
      }
      
      // Get the base64 data from the response
      const imageData = dalleResult.data[0];
      if (!imageData || !imageData.b64_json) {
        throw new Error("No base64 image data returned from API");
      }
      
      const base64Data = imageData.b64_json;
      
      console.log(`[IMAGE-GEN] Successfully received base64 data with length: ${base64Data.length}`);
      
      // Clean the base64 data
      const cleanedBase64 = cleanBase64(base64Data);
      
      // Try to infer MIME type from base64 data
      let mimeType = 'image/png'; // Default MIME type
      try {
        // Decode a small portion of the base64 to check the file signature
        const buffer = Buffer.from(cleanedBase64.substring(0, 100), 'base64');
        const inferredType = inferMimeTypeFromBuffer(buffer);
        
        if (inferredType) {
          console.log(`[IMAGE-GEN] Using inferred MIME type: ${inferredType}`);
          mimeType = inferredType;
        } else {
          console.log(`[IMAGE-GEN] Could not infer MIME type, using default: ${mimeType}`);
        }
      } catch (error) {
        console.error(`[IMAGE-GEN] Error inferring MIME type:`, error);
      }
      
      // Return the cleaned base64 data and inferred or default file type
      return { 
        base64: cleanedBase64, 
        fileType: mimeType,
        model: "dall-e-3"
      };
    }
  } catch (error) {
    console.error(`[IMAGE-GEN] Error with primary model ${actualModel}:`, error);
  
    // If we're already using DALL-E 3 or auto-selection is disabled, throw the error
    if (actualModel === 'dall-e-3' || model !== 'auto') {
      throw error;
    }
    
    // If we're here, we tried gpt-image-1 and it failed, so try DALL-E 3 as a fallback
    try {
      // Try fallback to DALL-E 3
      console.log(`[IMAGE-GEN] Falling back to DALL-E 3 model...`);
      
      // Call OpenAI API with dall-e-3 model
      const dalleResult = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: size as "1024x1024" | "1792x1024" | "1024x1792" | "1536x1024" | "1024x1536",
        response_format: "b64_json"
      });
      
      console.log(`[IMAGE-GEN] DALL-E 3 fallback successful`);
      
      // Get the base64 data from the response - use a type guard to ensure data exists
      const data = dalleResult.data;
      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error("No image data returned from API in DALL-E 3 fallback");
      }
      
      // Now TypeScript knows data exists and is an array
      const base64Data = data[0]?.b64_json;
      
      if (!base64Data) {
        throw new Error("No base64 image data returned from API fallback");
      }
      
      // Clean the base64 data
      const cleanedBase64 = cleanBase64(base64Data);
      
      // Try to infer MIME type from base64 data
      let mimeType = 'image/png'; // Default MIME type
      try {
        // Decode a small portion of the base64 to check the file signature
        const buffer = Buffer.from(cleanedBase64.substring(0, 100), 'base64');
        const inferredType = inferMimeTypeFromBuffer(buffer);
        
        if (inferredType) {
          mimeType = inferredType;
        }
      } catch (error) {
        console.error(`[IMAGE-GEN] Error inferring MIME type:`, error);
      }
      
      // Return the cleaned base64 data and inferred or default file type
      return { 
        base64: cleanedBase64, 
        fileType: mimeType,
        model: "dall-e-3"
      };
    } catch (fallbackError) {
      console.error(`[IMAGE-GEN] Error with DALL-E 3 fallback:`, fallbackError);
      
      // Try one last fallback using DALL-E 2 with URL response
      try {
        console.log(`[IMAGE-GEN] Final fallback to DALL-E 2 with URL response...`);
        
        // Using DALL-E 2 as a final fallback
        const fallbackResult = await openai.images.generate({
          prompt: prompt,
          n: 1,
          size: "1024x1024",
          response_format: "url"
        });
        
        console.log(`[IMAGE-GEN] DALL-E 2 fallback successful`);
        
        // Get the URL from the response
        const imageUrl = fallbackResult.data?.[0]?.url;
        
        if (!imageUrl) {
          throw new Error("No image URL returned from API fallback");
        }
        
        // Make a request to download the image
        console.log(`[IMAGE-GEN] Fetching image from URL to convert to base64`);
        const fetch = await import('node-fetch');
        const response = await fetch.default(imageUrl);
        const imageBuffer = await response.arrayBuffer();
        
        // Convert the buffer to base64
        const rawBase64Data = Buffer.from(imageBuffer).toString('base64');
        
        console.log(`[IMAGE-GEN] Successfully converted image to base64 with length: ${rawBase64Data.length}`);
        
        // Clean the base64 data
        const cleanedBase64 = cleanBase64(rawBase64Data);
        
        // Try to infer MIME type from the buffer
        const nodeBuffer = Buffer.from(imageBuffer);
        const inferredType = inferMimeTypeFromBuffer(nodeBuffer);
        
        // Use inferred type or default to png
        const mimeType = inferredType || 'image/png';
        console.log(`[IMAGE-GEN] Image MIME type: ${mimeType}`);
        
        // Return the cleaned base64 data and detected file type
        return { 
          base64: cleanedBase64, 
          fileType: mimeType,
          model: "dall-e-2" // Fallback model
        };
      } catch (finalFallbackError) {
        console.error(`[IMAGE-GEN] Error with final fallback approach:`, finalFallbackError);
        // Re-throw the original error since all approaches failed
        throw error;
      }
    }
  }
}

/**
 * Analyzes a card's interaction history to suggest improvements for a column's prompt
 * This function is triggered when a card is moved from one column to another
 * 
 * @param sourceColumnInstructions - The current instructions from the source column
 * @param cardContext - Object containing card details (title, description, etc)
 * @param chats - Array of chat messages associated with the card while in the source column
 * @param apiKey - Optional OpenAI API key to use for the analysis
 * @returns Promise resolving to an object with rationale and suggestedInstructions, or null if no suggestion
 */
// Use the imported test implementation for prompt suggestions

/**
 * Generates intelligent prompt improvement suggestions based on card interactions
 * 
 * This function analyzes the context of a card, its chat history, and the original column instructions
 * to suggest potential improvements to the AI prompt. It detects patterns in user interactions
 * and identifies areas where the instructions could be more specific or helpful.
 */
export async function getPromptSuggestion(
  sourceColumnInstructions: string,
  cardContext: { 
    title: string; 
    description: string | null; 
    attachments?: { filename: string; fileType: string }[] 
  },
  chats: Chat[],
  apiKey?: string
): Promise<{ rationale: string; suggestedInstructions: string } | null> {
  try {
    // Import the template system
    const { getTemplate, generateMetaPrompt } = await import('./promptAnalyzerTemplate');
    
    // Log inputs for analysis
    console.log(`\n======== PROMPT ASSISTANT ANALYSIS ========`);
    console.log(`Source Column Instructions: ${sourceColumnInstructions}`);
    console.log(`Card Title: ${cardContext.title}`);
    console.log(`Card Description: ${cardContext.description || "No description"}`);
    
    const attachments = cardContext.attachments || [];
    if (attachments.length > 0) {
      console.log(`Attachments: ${attachments.map(a => `${a.filename} (${a.fileType})`).join(', ')}`);
    } else {
      console.log(`Attachments: None`);
    }
    
    console.log(`Chat History: ${chats.length} messages`);
    chats.forEach((chat, index) => {
      console.log(`Chat #${index + 1} - ${chat.role}: ${chat.content.substring(0, 100)}${chat.content.length > 100 ? '...' : ''}`);
    });
    
    // Determine column type based on context for targeted analysis
    let columnType = "unknown";
    const columnNameLower = cardContext.title.toLowerCase();
    
    // Analyze column name and instructions to determine its purpose
    if (sourceColumnInstructions.toLowerCase().includes("image") || 
        columnNameLower.includes("image") || 
        columnNameLower.includes("imager") || 
        columnNameLower.includes("dall") ||
        columnNameLower.includes("visual")) {
      columnType = "image-generation";
    } else if (sourceColumnInstructions.toLowerCase().includes("summary") || 
               columnNameLower.includes("summary") || 
               columnNameLower.includes("summarize")) {
      columnType = "summary";
    } else if (sourceColumnInstructions.toLowerCase().includes("task") || 
               columnNameLower.includes("task") ||
               columnNameLower.includes("todo") ||
               columnNameLower.includes("to-do")) {
      columnType = "task-generation";
    } else if (sourceColumnInstructions.toLowerCase().includes("analysis") || 
               columnNameLower.includes("analysis") || 
               columnNameLower.includes("analyze")) {
      columnType = "analysis";
    }
    
    console.log(`Detected column type: ${columnType}`);
    
    // Get the appropriate template based on column type
    const template = await getTemplate(columnType);
    console.log(`Selected template: ${template ? 'Available' : 'Not available'} for ${columnType}`);
    
    // Generate a meta-prompt to analyze the interactions
    const metaPrompt = generateMetaPrompt(
      sourceColumnInstructions,
      cardContext.title,
      cardContext.description || "",
      chats,
      columnType,
      template
    );
    
    // Log meta-prompt length for analysis
    console.log(`Generated meta-prompt: ${metaPrompt.length} characters`);
    console.log(`Meta-prompt preview: ${metaPrompt.substring(0, 200)}...`);
    
    try {
      // Initialize OpenAI client
      const openai = getOpenAIClient(apiKey);
      
      // Request a new prompt suggestion from GPT-4
      const completion = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: "You are an expert prompt engineer that helps improve AI instructions." },
          { role: "user", content: metaPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      });
      
      // Process the response
      const response = completion.choices[0].message.content || "";
      console.log(`Received response: ${response.length} characters`);
      
      // Extract the structured data using a predictable format marker
      const formattedResponse = extractFormattedResponse(response);
      
      if (formattedResponse) {
        console.log(`Extracted suggestion: ${formattedResponse.suggestedInstructions.length} characters`);
        console.log(`Rationale: ${formattedResponse.rationale.substring(0, 100)}...`);
        console.log(`======== END PROMPT ASSISTANT ANALYSIS ========\n`);
        return formattedResponse;
      } else {
        console.log(`No structured suggestion found in response`);
        // For unstructured responses, attempt to parse using section markers
        const parsedResponse = parseUnstructuredResponse(response);
        if (parsedResponse) {
          console.log(`Parsed unstructured response successfully`);
          return parsedResponse;
        }
      }
      
      console.log(`Unable to extract a valid suggestion`);
      return null;
    } catch (apiError) {
      console.error("API error generating prompt suggestion:", apiError);
      return null;
    }
  } catch (error) {
    console.error("Error in getPromptSuggestion:", error);
    return null;
  }
}

/**
 * Helper function to extract structured response from GPT output
 */
function extractFormattedResponse(response: string): { rationale: string; suggestedInstructions: string } | null {
  try {
    // Look for JSON format responses
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const jsonData = JSON.parse(jsonMatch[1]);
      if (jsonData.suggestedInstructions && jsonData.rationale) {
        return {
          suggestedInstructions: jsonData.suggestedInstructions,
          rationale: jsonData.rationale
        };
      }
    }
    
    // Look for section markers format
    return parseUnstructuredResponse(response);
  } catch (parseError) {
    console.error("Error parsing structured response:", parseError);
    return null;
  }
}

/**
 * Parse response using section markers when not in JSON format
 */
function parseUnstructuredResponse(response: string): { rationale: string; suggestedInstructions: string } | null {
  // Look for rationale section
  const rationaleMatch = response.match(/(?:Rationale|RATIONALE|Reasoning|REASONING):?\s*([\s\S]*?)(?=(?:Suggested Instructions|SUGGESTED INSTRUCTIONS|New Instructions|NEW INSTRUCTIONS)|$)/i);
  
  // Look for suggested instructions section
  const instructionsMatch = response.match(/(?:Suggested Instructions|SUGGESTED INSTRUCTIONS|New Instructions|NEW INSTRUCTIONS):?\s*([\s\S]*?)(?:\n\n|$)/i);
  
  if (rationaleMatch && instructionsMatch) {
    return {
      rationale: rationaleMatch[1].trim(),
      suggestedInstructions: instructionsMatch[1].trim()
    };
  }
  
  return null;
}