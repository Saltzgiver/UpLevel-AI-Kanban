import OpenAI from "openai";
import { ChatCompletionContentPart, ChatCompletionMessageParam } from "openai/resources";
import { storage } from "./storage";
import { Column, Attachment, Chat } from "@shared/schema";
import { extractCSVContent, createCSVAttachmentFromText } from './csv-helper';
import { enhancedGenerateImage } from './enhanced-image-generation';

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
      // Not found, create new empty setting
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
  
  // Return empty string if not found or error
  return "";
}

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
    console.log("Creating new OpenAI client, using model: gpt-4o");
    
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
 * Processes a card with GPT when it's moved to a GPT-enabled column
 */
export async function triggerGPTProcessing(cardId: number, column: Column): Promise<void> {
  console.log(`Processing card ${cardId} with GPT in column ${column.name}`);
  
  try {
    // Get card details
    const card = await storage.getCard(cardId);
    if (!card) {
      console.error(`Card ${cardId} not found`);
      return;
    }
    
    // Log that we found the card
    console.log(`Found card ${cardId}: ${card.title}`);
    
    // Step 1: Get column instructions
    let instructions = column.instructions || "";
    if (!instructions.trim()) {
      console.log(`Column ${column.id} has no instructions, using default`);
      instructions = "Analyze this card and provide helpful feedback.";
    }
    
    // Step 2: Get global prompt
    const globalPrompt = await getGlobalPrompt();
    console.log(`Global prompt (${globalPrompt.length} chars): ${globalPrompt.substring(0, 50)}...`);
    
    // Step 3: Build system content
    let systemContent = `${globalPrompt}\n\n${instructions}\n\n`;
    
    // Add card context
    systemContent += `Card Title: ${card.title}\n`;
    systemContent += `Card Description: ${card.description || "No description provided."}\n\n`;
    
    // Get existing chats for context
    const chats = await storage.getCardChats(cardId);
    if (chats && chats.length > 0) {
      systemContent += `Previous interactions:\n`;
      chats.forEach(chat => {
        systemContent += `${chat.role === 'user' ? 'User' : 'Assistant'}: ${chat.content}\n`;
      });
    }
    
    // Step 4: Make API request
    const openai = getOpenAIClient(column.openai_api_key);
    
    // Prepare the messages array for the API request
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemContent,
      }
    ];
    
    // Log the request message
    console.log(`Making GPT request for card ${cardId} with ${messages.length} messages`);
    console.log(`System message length: ${systemContent.length} chars`);
    
    // Make the API request
    const response = await openai.chat.completions.create({
      model: column.gpt_model || "gpt-4o",
      messages: messages,
      temperature: column.temperature ? parseFloat(column.temperature) : 0.7,
    });
    
    // Extract response content
    const responseContent = response.choices[0]?.message?.content || "No response from GPT.";
    console.log(`Received GPT response for card ${cardId} (${responseContent.length} chars)`);
    
    // Step 5: Create a chat record for the response
    await storage.createChat({
      cardId,
      role: "assistant",
      content: responseContent,
      createdAt: new Date(),
    });
    
    // Step 6: Handle file generation if needed
    await handleFileGeneration(cardId, responseContent);
    
    console.log(`Completed GPT processing for card ${cardId}`);
    
  } catch (error) {
    console.error(`Error processing card ${cardId} with GPT:`, error);
    
    // Create a chat message about the error
    try {
      await storage.createChat({
        cardId,
        role: "assistant",
        content: `I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or contact support if this persists.`,
        createdAt: new Date(),
      });
    } catch (chatError) {
      console.error(`Failed to create error chat message:`, chatError);
    }
  }
}

/**
 * Processes a chat message with GPT
 */
export async function processChat(cardId: number, userMessage: string, column: Column): Promise<void> {
  console.log(`Processing chat message for card ${cardId} in column ${column.name}: "${userMessage.substring(0, 50)}..."`);
  
  try {
    // Get card details
    const card = await storage.getCard(cardId);
    if (!card) {
      console.error(`Card ${cardId} not found`);
      return;
    }
    
    // Get column instructions
    let instructions = column.instructions || "";
    if (!instructions.trim()) {
      console.log(`Column ${column.id} has no instructions, using default`);
      instructions = "You are a helpful assistant.";
    }
    
    // Get global prompt
    const globalPrompt = await getGlobalPrompt();
    console.log(`Global prompt (${globalPrompt.length} chars): ${globalPrompt.substring(0, 50)}...`);
    
    // Build system content
    let systemContent = `${globalPrompt}\n\n${instructions}\n\n`;
    
    // Add card context
    systemContent += `Card Title: ${card.title}\n`;
    systemContent += `Card Description: ${card.description || "No description provided."}\n\n`;
    
    // Get card attachments
    const attachments = await storage.getCardAttachments(cardId);
    console.log(`Card ${cardId} has ${attachments.length} attachments`);
    
    // Add information about attachments to system content
    if (attachments.length > 0) {
      systemContent += "Attachments:\n";
      attachments.forEach((att, index) => {
        systemContent += `- Attachment ${index + 1}: ${att.filename} (${att.fileType})\n`;
      });
      systemContent += "\n";
    }
    
    // Add CSV content to system content if available
    if (attachments.length > 0) {
      for (const attachment of attachments) {
        if (attachment.fileType === 'text/csv' || attachment.filename.endsWith('.csv')) {
          try {
            const csvContent = extractCSVContent(attachment.content);
            if (csvContent) {
              systemContent += `CSV Content from ${attachment.filename}:\n${csvContent}\n\n`;
            }
          } catch (csvError) {
            console.error(`Error extracting CSV content from attachment ${attachment.id}:`, csvError);
          }
        }
      }
    }
    
    // Get existing chats for context
    const chats = await storage.getCardChats(cardId);
    const chatHistory: ChatCompletionMessageParam[] = [];
    
    // Process previous chats
    if (chats && chats.length > 0) {
      // Only include up to the last 15 messages to avoid token limits
      const recentChats = chats.slice(-15);
      
      recentChats.forEach(chat => {
        chatHistory.push({
          role: chat.role as "user" | "assistant" | "system",
          content: chat.content,
        });
      });
    }
    
    // Add the user's new message to chat history
    await storage.createChat({
      cardId,
      role: "user",
      content: userMessage,
      createdAt: new Date(),
    });
    
    // Create the complete message array for the API request
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent },
      ...chatHistory,
      { role: "user", content: userMessage }
    ];
    
    // Create the OpenAI client
    const openai = getOpenAIClient(column.openai_api_key);
    
    // Check for image generation command
    const imageGenerationTriggers = [
      "generate an image of", "create an image of",
      "generate image of", "create image of",
      "create image:", "generate image:",
      "draw a picture of", "make an image of"
    ];
    
    const isImageGenerationRequest = imageGenerationTriggers.some(trigger => 
      userMessage.toLowerCase().includes(trigger.toLowerCase())
    );
    
    if (isImageGenerationRequest) {
      try {
        console.log(`Detected image generation request: "${userMessage}"`);
        
        // Create an intermediate chat message
        await storage.createChat({
          cardId,
          role: "assistant",
          content: "I'll generate that image for you. Please wait a moment...",
          createdAt: new Date(),
        });
        
        // Extract the image prompt from the user message
        let imagePrompt = userMessage;
        for (const trigger of imageGenerationTriggers) {
          if (userMessage.toLowerCase().includes(trigger.toLowerCase())) {
            const parts = userMessage.split(new RegExp(trigger, 'i'));
            if (parts.length > 1) {
              imagePrompt = parts[1].trim();
              break;
            }
          }
        }
        
        // If we couldn't extract a specific prompt, use the whole message
        if (imagePrompt === userMessage) {
          imagePrompt = userMessage.replace(/generate image|create image|draw|picture/gi, '').trim();
        }
        
        console.log(`Extracted image prompt: "${imagePrompt}"`);
        
        // Generate the image using our enhanced implementation
        const imageUrl = await enhancedGenerateImage(imagePrompt, column.openai_api_key);
        
        // Create a chat message with the generated image
        const chatContent = `Here's the image I generated based on your request:\n\n![Generated Image](${imageUrl})`;
        
        await storage.createChat({
          cardId,
          role: "assistant",
          content: chatContent,
          createdAt: new Date(),
        });
        
        // Create attachment record
        let filename = "generated-image.png";
        const fileType = imageUrl.startsWith("data:") 
          ? (imageUrl.split(';')[0].split(':')[1] || "image/png") 
          : "image/png";
        
        // Adjust filename based on detected type
        if (fileType.includes("/")) {
          const extension = fileType.split('/')[1];
          filename = `generated-image.${extension}`;
        }
        
        await storage.createAttachment({
          cardId,
          filename,
          fileType,
          content: imageUrl,
          createdAt: new Date(),
        });
        
        console.log(`Created image attachment for card ${cardId}`);
        return;
      } catch (imageError) {
        console.error(`Error generating image:`, imageError);
        
        // Create an error chat message
        await storage.createChat({
          cardId,
          role: "assistant",
          content: `I encountered an error while generating the image: ${imageError instanceof Error ? imageError.message : 'Unknown error'}. Please try again with a different description.`,
          createdAt: new Date(),
        });
        return;
      }
    }
    
    // Not an image request, so make a standard API request
    console.log(`Making GPT request for card ${cardId} with ${messages.length} messages`);
    
    // Make the API request
    const response = await openai.chat.completions.create({
      model: column.gpt_model || "gpt-4o",
      messages: messages,
      temperature: column.temperature ? parseFloat(column.temperature) : 0.7,
    });
    
    // Extract response content
    const responseContent = response.choices[0]?.message?.content || "No response from GPT.";
    console.log(`Received GPT response for card ${cardId} (${responseContent.length} chars)`);
    
    // Create a chat record for the response
    await storage.createChat({
      cardId,
      role: "assistant",
      content: responseContent,
      createdAt: new Date(),
    });
    
    // Handle any special processing like generating files
    await handleFileGeneration(cardId, responseContent);
    
  } catch (error) {
    console.error(`Error processing chat message for card ${cardId}:`, error);
    
    // Create a chat message about the error
    try {
      await storage.createChat({
        cardId,
        role: "assistant",
        content: `I encountered an error while processing your message: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or contact support if this persists.`,
        createdAt: new Date(),
      });
    } catch (chatError) {
      console.error(`Failed to create error chat message:`, chatError);
    }
  }
}

/**
 * Handles file generation based on response content
 */
async function handleFileGeneration(cardId: number, response: string): Promise<void> {
  try {
    // Check for CSV content markers
    if (response.includes('```csv') || response.includes('```CSV')) {
      console.log(`Detected CSV content in response for card ${cardId}`);
      
      // Extract CSV content from the markdown code block
      const csvRegex = /```csv\s*([\s\S]*?)\s*```|```CSV\s*([\s\S]*?)\s*```/g;
      const matches = [...response.matchAll(csvRegex)];
      
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const csvContent = (match[1] || match[2]).trim();
        
        if (csvContent.length > 0) {
          console.log(`Processing CSV content #${i+1} (${csvContent.length} chars)`);
          
          // Create attachment with the CSV content
          const attachment = await createCSVAttachmentFromText(cardId, csvContent, `generated-data-${i+1}.csv`);
          console.log(`Created CSV attachment ${attachment.id} for card ${cardId}`);
        }
      }
    }
    
    // Check for image URLs in the response
    const imageUrlRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
    const imageMatches = [...response.matchAll(imageUrlRegex)];
    
    for (const match of imageMatches) {
      const imageUrl = match[1];
      if (imageUrl && !imageUrl.includes('{{') && !imageUrl.includes('}}')) {
        console.log(`Found image URL in response: ${imageUrl.substring(0, 50)}...`);
        
        try {
          // Try to fetch the image
          const response = await fetch(imageUrl);
          
          if (response.ok) {
            const contentType = response.headers.get('content-type') || 'image/png';
            const content = await response.text();
            
            // Determine filename from URL or content type
            let filename = 'image.png';
            const urlParts = imageUrl.split('/');
            const lastPart = urlParts[urlParts.length - 1];
            
            if (lastPart && lastPart.includes('.')) {
              filename = lastPart.split('?')[0]; // Remove query parameters
            } else if (contentType.includes('/')) {
              const ext = contentType.split('/')[1];
              filename = `image.${ext}`;
            }
            
            // Create attachment
            await storage.createAttachment({
              cardId,
              filename,
              fileType: contentType,
              content,
              createdAt: new Date(),
            });
            
            console.log(`Created image attachment from URL for card ${cardId}`);
          } else {
            console.error(`Failed to fetch image from URL: ${response.status} ${response.statusText}`);
          }
        } catch (imageError) {
          console.error(`Error processing image URL:`, imageError);
        }
      }
    }
  } catch (error) {
    console.error(`Error handling file generation for card ${cardId}:`, error);
  }
}

/**
 * Generates an image with OpenAI's latest image generation model
 * This function is now a thin wrapper around enhancedGenerateImage
 */
export async function generateImage(prompt: string, apiKey?: string): Promise<string> {
  try {
    return await enhancedGenerateImage(prompt, apiKey);
  } catch (error) {
    console.error(`Error in generateImage wrapper:`, error);
    throw error;
  }
}

/**
 * Generates intelligent prompt improvement suggestions based on card interactions
 * This function analyzes the context of a card, its chat history, and the original column instructions
 * to suggest potential improvements to the AI prompt.
 */
export async function getPromptSuggestion(
  sourceColumnInstructions: string,
  cardContext: {
    cardId: number;
    title: string;
    description: string;
    chats: Chat[];
  }
): Promise<string | null> {
  try {
    console.log(`Generating prompt suggestion for column instructions: "${sourceColumnInstructions.substring(0, 50)}..."`);
    console.log(`Card context: ${cardContext.title}, ${cardContext.chats.length} chats`);
    
    // Skip if no chats to analyze
    if (!cardContext.chats || cardContext.chats.length < 2) {
      console.log(`Not enough chat history to generate a meaningful suggestion`);
      return null;
    }
    
    // Get the OpenAI client
    const openai = getOpenAIClient();
    
    // Prepare system prompt
    const systemPrompt = `You are an expert prompt engineer who helps improve AI system prompts based on observed interactions.
Your task is to analyze a conversation between a user and an AI assistant, then suggest improvements to the system instructions that were given to the AI.
Focus on making the instructions more specific, helpful, and aligned with what the user was trying to accomplish.
Provide a concrete, improved version of the instructions - do not just describe changes in abstract terms.
Your suggested improvement should be complete and standalone - users should be able to directly copy and use your suggestion.`;

    // Prepare detailed conversation context
    let conversationContext = `ORIGINAL INSTRUCTIONS:\n${sourceColumnInstructions}\n\n`;
    conversationContext += `CARD TITLE: ${cardContext.title}\n\n`;
    conversationContext += `CARD DESCRIPTION: ${cardContext.description || "None"}\n\n`;
    conversationContext += `CONVERSATION HISTORY:\n\n`;
    
    // Add chat history
    cardContext.chats.forEach((chat, index) => {
      conversationContext += `${chat.role.toUpperCase()}: ${chat.content}\n\n`;
    });
    
    // User request
    const userRequest = `Please analyze this conversation and suggest an improved version of the instructions. 
Focus on making the instructions more specific to this kind of task, adding any missing details that would have made the AI's responses more helpful,
and addressing any confusion or misunderstandings that occurred in the conversation.
Provide your improved instructions as a complete replacement, not just describing changes.`;
    
    // Make the API request
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: conversationContext },
        { role: "user", content: userRequest }
      ],
      temperature: 0.7,
    });
    
    // Extract and return the suggestion
    const suggestion = response.choices[0]?.message?.content || null;
    
    if (suggestion) {
      console.log(`Generated prompt suggestion (${suggestion.length} chars): "${suggestion.substring(0, 100)}..."`);
      return suggestion;
    } else {
      console.log(`No prompt suggestion generated`);
      return null;
    }
    
  } catch (error) {
    console.error(`Error generating prompt suggestion:`, error);
    return null;
  }
}