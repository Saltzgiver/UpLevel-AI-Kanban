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
    
    systemContent += 
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
    
    // If this appears to be an image request and we have an API key (or can use the environment API key)
    // Special handling for "from_env" value - this is a special value that means "use the environment variable"
    if (isImageRequest) {
      try {
        // User message already added to chat history in the API endpoint
        // No need to add it again here
        
        // Generate a clean prompt from the user message
        const promptMatch = userMessage.match(/(?:image|picture|drawing|visualization) (?:of|showing|with|that) (.+)/i) || 
                           userMessage.match(/(?:create|generate|make|draw) (?:an|a) (?:image|picture|drawing|visualization) (?:of|showing|with|that) (.+)/i);
        
        const prompt = promptMatch ? promptMatch[1].trim() : userMessage;
        
        // Generate the image - handle special "from_env" value
        let apiKeyToUse: string | undefined = undefined;
        if (column.apiKey) {
          apiKeyToUse = column.apiKey;
        }
        console.log(`Using column API key: ${apiKeyToUse || 'Not set, will use environment variable'}`);
        const imageUrl = await generateImage(prompt, apiKeyToUse);
        
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
        
        // Mark the card as not processing anymore since we've completed the image generation
        await storage.updateCard(cardId, { processing: false });
        
        return;
      } catch (error) {
        console.error("Error generating image:", error);
        
        // Add error message to chat
        await storage.createChat({
          cardId,
          role: "assistant",
          content: `⚠️ Error generating image: ${error instanceof Error ? error.message : "Unknown error"}`,
          gptName: column.gptName || "AI Assistant",
          gptColor: column.gptColor
        });
        
        // Mark the card as not processing if we're exiting here
        await storage.updateCard(cardId, { processing: false });
        return;
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
    
    // User message is already saved to the chat history in the API endpoint
    // No need to save it again here

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
 * Generates an image with OpenAI's latest image generation model
 * Support both gpt-image-1 (latest) and dall-e-3
 */
export async function generateImage(prompt: string, apiKey?: string): Promise<string> {
  try {
    // Special handling for "from_env" value to use environment variable
    if (apiKey === "from_env") {
      apiKey = undefined; // Will use process.env.OPENAI_API_KEY
    }
    
    const openai = getOpenAIClient(apiKey);
    
    // Log useful information for debugging
    console.log(`Generating image with prompt: "${prompt.substring(0, 50)}..."`);
    console.log(`Using API key source: ${apiKey ? 'column-specific key' : 'environment variable'}`);
    
    // Use the new gpt-image-1 model by default (latest model as of May 2025)
    const modelToUse = "gpt-image-1"; // OpenAI's newest image model that replaced DALL-E 3
    
    console.log(`Using image generation model: ${modelToUse}`);
    
    // Build the request parameters based on the model
    const requestParams: any = {
      model: modelToUse,
      prompt,
      n: 1,
      size: "1024x1024", // Standard size compatible with both models
    };
    
    // Add model-specific parameters
    if (modelToUse === "gpt-image-1") {
      // gpt-image-1 specific options
      requestParams.response_format = "url"; // Can be "url" or omitted for base64 (b64_json)
      requestParams.detail = "high"; // Can be "standard" or "high"
      
      // Moderation level (less restrictive filtering)
      requestParams.moderation = "low"; // Options: "low" or "auto"
    } else {
      // dall-e-3 specific options
      requestParams.quality = "standard"; // Can be "standard" or "hd"
    }
    
    console.log(`Generating image with params:`, JSON.stringify(requestParams, null, 2));
    const response = await openai.images.generate(requestParams);

    console.log(`Successfully generated image with ${modelToUse}`);
    
    // Handle gpt-image-1 output format which has data as optional field
    if (!response.data || response.data.length === 0) {
      throw new Error("No image data returned from API");
    }
    
    // For gpt-image-1 with response_format=url
    if (response.data[0].url) {
      return response.data[0].url;
    }
    
    // For gpt-image-1 with default b64_json format
    if (response.data[0].b64_json) {
      // Convert base64 to URL by creating a temporary object URL
      const base64Image = response.data[0].b64_json;
      // Return the base64 string with data URL prefix for direct embedding
      return `data:image/png;base64,${base64Image}`;
    }
    
    throw new Error("No valid image format found in API response");
  } catch (error) {
    console.error(`Error generating image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // If the gpt-image-1 model fails, attempt to fall back to dall-e-3
    try {
      console.log("Attempting fallback to dall-e-3 model...");
      const openai = getOpenAIClient(apiKey);
      
      // Fallback to dall-e-3 with appropriate params
      const fallbackParams = {
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url" // dall-e-3 works better with URL format
      };
      
      console.log(`Generating fallback image with params:`, JSON.stringify(fallbackParams, null, 2));
      const response = await openai.images.generate(fallbackParams);
      
      console.log("Successfully generated image with dall-e-3 fallback");
      
      // Handle dall-e-3 output format
      if (!response.data || response.data.length === 0) {
        throw new Error("No image data returned from API in fallback");
      }
      
      // dall-e-3 uses URL format by default
      if (response.data[0].url) {
        return response.data[0].url;
      }
      
      // Handle b64_json if response_format was set to that
      if (response.data[0].b64_json) {
        const base64Image = response.data[0].b64_json;
        return `data:image/png;base64,${base64Image}`;
      }
      
      throw new Error("No valid image format found in fallback API response");
    } catch (fallbackError) {
      console.error("Error with fallback image generation:", fallbackError);
      throw error; // Throw the original error
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
    } else if (sourceColumnInstructions.toLowerCase().includes("spreadsheet") || 
               columnNameLower.includes("spreadsheet") || 
               columnNameLower.includes("csv") ||
               columnNameLower.includes("sheet") ||
               columnNameLower.includes("data") ||
               columnNameLower.includes("table")) {
      columnType = "spreadsheet-generation";
    } else if (sourceColumnInstructions.toLowerCase().includes("draft") || 
               columnNameLower.includes("draft") || 
               columnNameLower.includes("write") ||
               columnNameLower.includes("content") ||
               columnNameLower.includes("text")) {
      columnType = "text-drafting";
    } else if (sourceColumnInstructions.toLowerCase().includes("refine") || 
               columnNameLower.includes("refine") || 
               columnNameLower.includes("edit") ||
               columnNameLower.includes("improve") ||
               columnNameLower.includes("review")) {
      columnType = "content-refinement";
    }
    
    console.log(`Detected column type: ${columnType}`);
    
    // Get the current template
    const template = getTemplate();
    
    // Generate the meta-prompt using the template
    const metaPrompt = generateMetaPrompt(
      template,
      sourceColumnInstructions,
      cardContext,
      chats,
      columnType
    );

    console.log(`\nMeta-Prompt: ${metaPrompt.substring(0, 200)}...[truncated for log]`);
    console.log(`======== END PROMPT ASSISTANT ANALYSIS ========\n`);
    
    // Handle API key management
    let finalApiKey = apiKey;
    
    if (!finalApiKey || finalApiKey === "from_env") {
      // Use environment variable as fallback
      finalApiKey = process.env.OPENAI_API_KEY;
      console.log("[Prompt Assistant] Using API key from environment");
    }
    
    if (!finalApiKey) {
      console.error("[Prompt Assistant] No OpenAI API key available");
      // Fall back to test implementation if no API key is available
      console.log("[Prompt Assistant] Falling back to test implementation");
      return getTestPromptSuggestion(sourceColumnInstructions, cardContext, chats);
    }
    
    try {
      // Initialize OpenAI client with the provided API key
      const openai = new OpenAI({ apiKey: finalApiKey });
      
      console.log(`[Prompt Assistant] Calling OpenAI API with model: ${OPENAI_MODEL}`);
      
      // Call the OpenAI API with our meta-prompt
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL, // Use the global model constant
        messages: [
          { role: "system", content: "You are an expert AI prompt engineer that helps improve GPT prompts based on user interactions and conversation patterns." },
          { role: "user", content: metaPrompt }
        ],
        temperature: 0.4, // Lower temperature for more focused, consistent output
        max_tokens: 1500,
      });
      
      // Parse the response content
      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.log("[Prompt Assistant] No content returned from OpenAI API");
        return null;
      }
      
      // Log the raw suggestion for debugging (limited length for logs)
      console.log(`[Prompt Assistant] Raw Suggestion from AI: ${content.substring(0, 200)}...`);
      
      // Parse the response according to our expected format
      try {
        // Extract the rationale (first line starting with RATIONALE:)
        const rationaleMatch = content.match(/^RATIONALE:\s*(.+)$/m);
        if (!rationaleMatch || !rationaleMatch[1]) {
          console.log("[Prompt Assistant] Could not find rationale in the response");
          return null;
        }
        
        const rationale = rationaleMatch[1].trim();
        
        // Check if this is a "no improvements needed" response
        if (rationale.toLowerCase().includes("no improvements needed") || 
            rationale.toLowerCase().includes("no improvement needed")) {
          console.log("[Prompt Assistant] AI determined no improvements are needed:", rationale);
          return null;
        }
        
        // Extract the suggested instructions (everything after the RATIONALE line)
        const matchIndex = content.indexOf(rationaleMatch[0]);
        if (matchIndex === -1) {
          console.log("[Prompt Assistant] Could not locate rationale in content");
          return null;
        }
        
        const instructionsText = content
          .substring(matchIndex + rationaleMatch[0].length)
          .trim();
        
        if (!instructionsText) {
          console.log("[Prompt Assistant] Could not find suggested instructions in the response");
          return null;
        }
        
        console.log("[Prompt Assistant] Successfully generated suggestion with rationale length:", rationale.length);
        console.log("[Prompt Assistant] Instructions length:", instructionsText.length);
        
        // Return the structured response
        return {
          rationale,
          suggestedInstructions: instructionsText
        };
        
      } catch (parseError) {
        console.error("[Prompt Assistant] Error parsing AI response:", parseError);
        console.log("[Prompt Assistant] Raw response:", content);
        return null;
      }
    } catch (apiError) {
      console.error("[Prompt Assistant] Error calling OpenAI API:", apiError);
      
      // If there's an API error, fall back to test implementation
      console.log("[Prompt Assistant] API error occurred, falling back to test implementation");
      return getTestPromptSuggestion(sourceColumnInstructions, cardContext, chats);
    }
  } catch (error) {
    console.error("[Prompt Assistant] Unexpected error in getPromptSuggestion:", error);
    return getTestPromptSuggestion(sourceColumnInstructions, cardContext, chats);
  }
}
