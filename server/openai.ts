import OpenAI from "openai";
import { storage } from "./storage";
import { Column } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const OPENAI_MODEL = "gpt-4o";

// Initialize OpenAI client
const getOpenAIClient = (apiKey?: string) => {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("No OpenAI API key provided");
  }
  return new OpenAI({ apiKey: key });
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

    // Include existing chats for context if any
    if (card.chats && card.chats.length > 0) {
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
        
        // For text-based files (txt, csv, md, etc.), include the content directly
        if (attachment.fileType.includes('text') || 
            attachment.filename.endsWith('.txt') || 
            attachment.filename.endsWith('.csv') || 
            attachment.filename.endsWith('.md')) {
          prompt += `Content of ${attachment.filename}:\n${attachment.content}\n\n`;
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

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: `Process this card: ${card.title}` }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

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
      `${card.gptTags ? `This card has the following tags: ${card.gptTags}` : ""}\n\n`;
    
    // Include attachments if any
    if (card.attachments && card.attachments.length > 0) {
      systemContent += "This card has the following attachments:\n";
      for (const attachment of card.attachments) {
        systemContent += `- ${attachment.filename} (${attachment.fileType})\n`;
        
        // For text-based files (txt, csv, md, etc.), include the content directly
        if (attachment.fileType.includes('text') || 
            attachment.filename.endsWith('.txt') || 
            attachment.filename.endsWith('.csv') || 
            attachment.filename.endsWith('.md')) {
          systemContent += `Content of ${attachment.filename}:\n${attachment.content}\n\n`;
        } else if (attachment.fileType.includes('image')) {
          // For images, just note that there's an image attached
          systemContent += `Note: This is an image file. Please reference it by filename if needed.\n\n`;
        } else {
          // For other file types, add a generic note
          systemContent += `Note: This is a ${attachment.fileType} file. You can reference it by filename.\n\n`;
        }
      }
    }
    
    systemContent += "Respond helpfully and concisely to the user's message. " + 
      "You can reference and analyze the attached files in your response as needed. " +
      "You can also generate new files if needed by using the syntax: ```file:filename.ext,mimetype,content```";
    
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      {
        role: "system",
        content: systemContent
      }
    ];

    // Add chat history
    if (card.chats && card.chats.length > 0) {
      for (const chat of card.chats) {
        messages.push({
          role: chat.role as "user" | "assistant",
          content: chat.content
        });
      }
    }

    // Add the new user message
    messages.push({
      role: "user",
      content: userMessage
    });

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
  // Check for file generation directives in the response
  const fileRegex = /```(?:file|attachment):([^,]+),\s*([^,]+),\s*([^`]+)```/g;
  let match;

  while ((match = fileRegex.exec(response)) !== null) {
    try {
      const [_, filename, fileType, content] = match;
      
      // Create attachment
      await storage.createAttachment({
        cardId,
        filename: filename.trim(),
        fileType: fileType.trim(),
        content: content.trim()
      });
    } catch (error) {
      console.error("Error creating attachment:", error);
    }
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
