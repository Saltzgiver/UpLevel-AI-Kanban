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
    
    // Log the response to check for image markdown references
    console.log("==========================================================");
    console.log("OPENAI RESPONSE ANALYSIS - Card ID:", cardId);
    console.log("Checking for image references in response");
    console.log("Response length:", response.length);
    console.log("Response contains '![' (image markdown):", response.includes("!["));
    console.log("Response contains 'attachment:':", response.includes("attachment:"));
    
    // Check for image pattern
    const imageMarkdownPattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const imageMatches = [...response.matchAll(imageMarkdownPattern)];
    console.log("Image markdown matches found:", imageMatches.length);
    for (const match of imageMatches) {
      console.log("- Image markdown:", match[0]);
      console.log("  - Alt text:", match[1]);
      console.log("  - URL/src:", match[2]);
    }
    console.log("==========================================================");
    
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
        // Format the message to clearly indicate an image was generated successfully
        const imageMessage = `
✨ **Image Generated Successfully**

**Prompt:** "${prompt}"

![Generated image](attachment:${attachment.id})

_Image generated using DALL-E 3_
`;
        
        await storage.createChat({
          cardId,
          role: "assistant",
          content: imageMessage,
          gptName: column.gptName || "AI Assistant",
          gptColor: column.gptColor
        });
        
        return;
      } catch (error) {
        console.error("===========================================");
        console.error("ERROR GENERATING IMAGE");
        console.error("Prompt:", prompt);
        console.error("Column API Key present:", !!column.apiKey);
        console.error("Environment API Key present:", !!process.env.OPENAI_API_KEY);
        console.error("Error details:", error instanceof Error ? error.message : String(error));
        console.error("Full error:", error);
        console.error("===========================================");
        
        // Construct a user-friendly error message
        let errorMessage = "I was unable to generate the requested image.";
        
        if (error instanceof Error) {
          if (error.message.includes("status code 401")) {
            errorMessage += " The API key is invalid or not authorized for DALL-E image generation.";
          } else if (error.message.includes("status code 429")) {
            errorMessage += " The API rate limit has been exceeded. Please try again in a few moments.";
          } else if (error.message.includes("status code 400")) {
            errorMessage += " Your prompt may contain content that violates OpenAI's content policy.";
          } else {
            errorMessage += " " + error.message;
          }
        }
        
        // Add detailed error message to chat for transparency
        await storage.createChat({
          cardId,
          role: "assistant",
          content: `❌ **Image Generation Failed**\n\n${errorMessage}`,
          gptName: column.gptName || "AI Assistant",
          gptColor: column.gptColor
        });
        
        // Return to prevent regular chat processing from happening
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
    
    // Log the chat response to check for image markdown references
    console.log("==========================================================");
    console.log("CHAT RESPONSE ANALYSIS - Card ID:", cardId);
    console.log("Checking for image references in chat response");
    console.log("Response length:", response.length);
    console.log("Response contains '![' (image markdown):", response.includes("!["));
    console.log("Response contains 'attachment:':", response.includes("attachment:"));
    
    // Check for image pattern
    const imageMarkdownPattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const imageMatches = [...response.matchAll(imageMarkdownPattern)];
    console.log("Image markdown matches found:", imageMatches.length);
    for (const match of imageMatches) {
      console.log("- Image markdown:", match[0]);
      console.log("  - Alt text:", match[1]);
      console.log("  - URL/src:", match[2]);
    }
    console.log("==========================================================");

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
  
  // Helper function to process file content based on type
  const processFileContent = async (filename: string, fileType: string, content: string) => {
    // Special handling for CSV files
    if (fileType.trim().includes('csv') || filename.trim().endsWith('.csv')) {
      console.log(`Handling CSV file: ${filename.trim()}`);
      await createCSVIfUnique(content.trim(), filename.trim());
    } else {
      // Handle all other file types, including images
      console.log(`Creating attachment: ${filename.trim()} (${fileType.trim()})`);
      
      // Special handling for placeholder content from OpenAI
      if (content.trim() === "base64encodedcontent" || content.trim() === "") {
        console.log("Detected placeholder content. Attempting to generate a real image...");
        
        // Extract image description from filename or use a default
        let imagePrompt = filename.replace(/\.(png|jpg|jpeg|gif)$/i, '').replace(/[-_]/g, ' ');
        
        if (imagePrompt.length < 10) {
          imagePrompt = "A simple illustration of " + imagePrompt;
        }
        
        try {
          // Generate a real image using DALL-E
          const imageUrl = await generateImage(imagePrompt);
          
          // Fetch the image data
          console.log("Generated image URL, fetching image data:", imageUrl);
          const imageResponse = await fetch(imageUrl);
          
          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image data: ${imageResponse.statusText}`);
          }
          
          // Convert the image to base64
          const imageBuffer = await imageResponse.arrayBuffer();
          const base64Image = Buffer.from(imageBuffer).toString('base64');
          
          // Create the attachment with the real image data
          await storage.createAttachment({
            cardId,
            filename: filename.trim(),
            fileType: fileType.trim(),
            content: base64Image
          });
          
          console.log("Successfully created image attachment with real image data");
        } catch (imageError) {
          console.error("Failed to generate a real image:", imageError);
          // Create a dummy attachment so the UI shows something
          await storage.createAttachment({
            cardId,
            filename: filename.trim(),
            fileType: fileType.trim(),
            content: "" // Empty content for error case
          });
        }
      } else {
        // Process normally if content is provided
        await storage.createAttachment({
          cardId,
          filename: filename.trim(),
          fileType: fileType.trim(),
          content: content.trim()
        });
      }
    }
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
    
    // Proceed with standard file attachment patterns
    // Two patterns:
    // 1. The code block format: ```file:filename.ext,type,content```
    // 2. The inline format: file:filename.ext,type,content (no code blocks)
    
    // First check for code block format
    const codeBlockFileRegex = /```(?:file|attachment):([^,]+),\s*([^,]+),\s*([^`]+)```/g;
    let match;
    
    console.log(`Checking for file attachments with code block format`);
    while ((match = codeBlockFileRegex.exec(response)) !== null) {
      try {
        const [_, filename, fileType, content] = match;
        console.log(`Found file in code block format: ${filename}`);
        
        await processFileContent(filename, fileType, content);
        attachmentsCreated++;
      } catch (error) {
        console.error("Error processing file in code block:", error);
      }
    }
    
    // Then check for the inline format (without code blocks)
    const inlineFileRegex = /file:([^,]+),\s*([^,]+),\s*([^\n]+)/g;
    console.log(`Checking for file attachments with inline format`);
    while ((match = inlineFileRegex.exec(response)) !== null) {
      try {
        const [_, filename, fileType, content] = match;
        console.log(`Found file in inline format: ${filename}`);
        
        await processFileContent(filename, fileType, content);
        attachmentsCreated++;
      } catch (error) {
        console.error("Error processing file in inline format:", error);
      }
    }
    
    // Legacy code for backward compatibility - to be removed after testing
    console.log(`Checking for file attachments with legacy format`);
    while ((match = /```(?:file|attachment):([^,]+),\s*([^,]+),\s*([^`]+)```/g.exec(response)) !== null) {
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
    console.log("===== IMAGE GENERATION REQUEST =====");
    console.log("Prompt:", prompt.substring(0, 50) + (prompt.length > 50 ? "..." : ""));
    
    // Use provided API key, column key, or environment variable (in that order)
    const effectiveApiKey = apiKey || process.env.OPENAI_API_KEY;
    
    if (!effectiveApiKey) {
      console.error("No API key available for image generation");
      throw new Error("Missing OpenAI API key for image generation");
    }
    
    console.log(`API Key: ${effectiveApiKey.substring(0, 3)}...${effectiveApiKey.substring(effectiveApiKey.length - 3)} (${effectiveApiKey.length} chars)`);
    
    const openai = getOpenAIClient(effectiveApiKey);
    
    console.log("Calling OpenAI API for image generation...");
    const startTime = Date.now();
    
    // Try to use DALL-E 3, but fall back to DALL-E 2 if there's an issue
    let response;
    try {
      response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      });
      console.log("Successfully used DALL-E 3 model");
    } catch (dalle3Error) {
      console.warn("DALL-E 3 failed, trying DALL-E 2 as fallback:", dalle3Error.message);
      response = await openai.images.generate({
        model: "dall-e-2",
        prompt,
        n: 1,
        size: "1024x1024",
      });
      console.log("Successfully used DALL-E 2 model as fallback");
    }
    
    const duration = Date.now() - startTime;
    console.log(`API call completed in ${duration}ms`);

    if (!response.data || !response.data[0] || !response.data[0].url) {
      console.error("DALL-E response missing URL:", JSON.stringify(response));
      throw new Error("Invalid response from DALL-E image generation");
    }
    
    console.log(`SUCCESS: Image URL generated (${response.data[0].url.length} chars)`);
    console.log("===== END OF IMAGE GENERATION =====");
    return response.data[0].url;
  } catch (error) {
    console.error("=======================================");
    console.error("     ERROR GENERATING IMAGE           ");
    console.error("=======================================");
    console.error("Prompt:", prompt);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    console.error(error);
    console.error("=======================================");
    
    // Include a more specific error message based on the error
    let errorMessage = "Failed to generate image with DALL-E";
    
    if (error instanceof Error) {
      if (error.message.includes("status code 401") || error.message.includes("Unauthorized")) {
        errorMessage = "Invalid or unauthorized OpenAI API key. Your API key might not have DALL-E access enabled.";
      } else if (error.message.includes("status code 429") || error.message.includes("Rate limit")) {
        errorMessage = "OpenAI API rate limit exceeded. Please try again in a few moments.";
      } else if (error.message.includes("status code 400") || error.message.includes("content policy")) {
        errorMessage = "Bad request to OpenAI API. Your prompt may contain content that violates OpenAI's content policy.";
      } else if (error.message.includes("network") || error.message.includes("ECONNRESET")) {
        errorMessage = "Network error when connecting to OpenAI. Please check your internet connection and try again.";
      }
    }
    
    throw new Error(errorMessage);
  }
}
