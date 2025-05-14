import OpenAI from "openai";
import { ChatCompletionContentPart, ChatCompletionMessageParam } from "openai/resources";
import { storage } from "./storage";
import { Column, Attachment, Chat } from "@shared/schema";
import { extractCSVContent, createCSVAttachmentFromText } from './csv-helper';

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

    // Image generation detection (functionality removed for reimplementation)
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
      /image of/i,
      /picture of/i,
      /visualization of/i
    ];

    const isImageRequest = imageRequestPatterns.some(pattern => pattern.test(userMessage));
    
    // Image generation has been temporarily disabled for reimplementation
    if (isImageRequest) {
      console.log(`[IMAGE-HANDLING] Image generation request detected but functionality is disabled for reimplementation`);
      
      // Inform the user that image generation is temporarily disabled
      await storage.createChat({
        cardId,
        role: "assistant",
        content: `⚠️ Image generation is temporarily unavailable as we're improving this feature. Regular chat functionality is still available.`,
        gptName: column.gptName || "AI Assistant",
        gptColor: column.gptColor
      });
      
      // Mark the card as not processing
      await storage.updateCard(cardId, { processing: false });
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
async function handleFileGeneration(cardId: number, response: string): Promise<void> {
  console.log(`=== FILE GENERATION START: Card ${cardId} ===`);
  let attachmentsCreated = 0;
  
  // Keep track of created CSV content hashes to prevent duplicates
  const processedHashes = new Set<string>();
  
  try {
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
 * Placeholder for image generation functionality (removed)
 * This will be reimplemented in the future
 */
/**
 * Generates an image using OpenAI's gpt-image-1 model
 * 
 * @param prompt Text prompt to generate the image from
 * @param apiKey Optional API key, if not provided will use environment variable
 * @returns Object containing base64 image data and file type
 */
export async function generateImage(prompt: string, apiKey?: string): Promise<{ base64: string, fileType: string }> {
  console.log(`[IMAGE-GEN] Starting image generation with prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
  console.log(`[IMAGE-GEN] API key source: ${apiKey ? 'custom key provided' : 'using environment variable'}`);
  
  // Initialize OpenAI client
  const openai = getOpenAIClient(apiKey);
  
  try {
    console.log(`[IMAGE-GEN] Using gpt-image-1 model for image generation`);
    console.log(`[IMAGE-GEN] Parameters: model=gpt-image-1, n=1, size=1024x1024`);
    
    // Call the OpenAI API to generate the image
    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt,
      n: 1,
      size: "1024x1024"
    });
    
    console.log(`[IMAGE-GEN] API call to gpt-image-1 successful`);
    
    // Check if we have data in the response
    if (!result?.data || !Array.isArray(result.data) || result.data.length === 0) {
      throw new Error("No image data returned from API");
    }
    
    // Get the URL from the response - using non-null assertion since we've already checked
    const imageUrl = result.data[0]?.url;
    
    if (!imageUrl) {
      throw new Error("No image URL returned from API");
    }
    
    console.log(`[IMAGE-GEN] Successfully received image URL: ${imageUrl}`);
    
    // Make a request to download the image
    console.log(`[IMAGE-GEN] Fetching image from URL to convert to base64`);
    const fetch = await import('node-fetch');
    const response = await fetch.default(imageUrl);
    const imageBuffer = await response.arrayBuffer();
    
    // Convert the buffer to base64
    const base64Data = Buffer.from(imageBuffer).toString('base64');
    
    console.log(`[IMAGE-GEN] Successfully converted image to base64 with length: ${base64Data.length}`);
    
    // Return the base64 data and file type
    const returnObj = { 
      base64: base64Data, 
      fileType: 'image/png' 
    };
    
    console.log(`[IMAGE-GEN] Returning base64 image data`);
    return returnObj;
    
  } catch (error) {
    console.error(`[IMAGE-GEN] Error generating image:`, error);
    throw error;
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
// Import the test implementation
import { getTestPromptSuggestion, PromptSuggestion } from "./test-prompt-assistant";

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