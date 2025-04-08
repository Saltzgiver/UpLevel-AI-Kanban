import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { triggerGPTProcessing, processChat, generateImage } from "./openai";
import { insertBoardSchema, insertColumnSchema, insertCardSchema, insertChatSchema } from "@shared/schema";
import { z } from "zod";
import { ZodError } from "zod";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fromZodError } from "zod-validation-error";

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

export async function registerRoutes(app: Express): Promise<Server> {
  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof ZodError) {
      const validationError = fromZodError(err);
      return res.status(400).json({ 
        message: "Validation error", 
        errors: validationError.details 
      });
    }
    next(err);
  });

  // BOARD ROUTES
  app.get("/api/boards", async (req, res) => {
    try {
      const boards = await storage.getBoards();
      return res.json(boards);
    } catch (error) {
      console.error("Error fetching boards:", error);
      return res.status(500).json({ message: "Error fetching boards" });
    }
  });

  app.get("/api/boards/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const board = await storage.getBoardById(id);
      
      if (!board) {
        return res.status(404).json({ message: "Board not found" });
      }
      
      return res.json(board);
    } catch (error) {
      console.error("Error fetching board:", error);
      return res.status(500).json({ message: "Error fetching board" });
    }
  });

  app.post("/api/boards", async (req, res) => {
    try {
      const data = insertBoardSchema.parse(req.body);
      const board = await storage.createBoard(data);
      return res.status(201).json(board);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: fromZodError(error).details 
        });
      }
      console.error("Error creating board:", error);
      return res.status(500).json({ message: "Error creating board" });
    }
  });

  app.patch("/api/boards/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name } = req.body;
      
      const board = await storage.updateBoard(id, { name });
      
      if (!board) {
        return res.status(404).json({ message: "Board not found" });
      }
      
      return res.json(board);
    } catch (error) {
      console.error("Error updating board:", error);
      return res.status(500).json({ message: "Error updating board" });
    }
  });

  app.patch("/api/boards/:id/reorder-columns", async (req, res) => {
    try {
      const boardId = parseInt(req.params.id);
      const { updates } = req.body;
      
      if (!Array.isArray(updates)) {
        return res.status(400).json({ message: "Updates must be an array" });
      }
      
      await storage.reorderColumns(boardId, updates);
      return res.json({ message: "Columns reordered" });
    } catch (error) {
      console.error("Error reordering columns:", error);
      return res.status(500).json({ message: "Error reordering columns" });
    }
  });

  // COLUMN ROUTES
  app.post("/api/columns", async (req, res) => {
    try {
      const data = insertColumnSchema.parse({
        ...req.body,
        order: 999 // Will be updated by the storage layer
      });
      
      const column = await storage.createColumn(data);
      return res.status(201).json(column);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: fromZodError(error).details
        });
      }
      console.error("Error creating column:", error);
      return res.status(500).json({ message: "Error creating column" });
    }
  });

  app.patch("/api/columns/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name } = req.body;
      
      const column = await storage.updateColumn(id, { name });
      
      if (!column) {
        return res.status(404).json({ message: "Column not found" });
      }
      
      return res.json(column);
    } catch (error) {
      console.error("Error updating column:", error);
      return res.status(500).json({ message: "Error updating column" });
    }
  });

  app.delete("/api/columns/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteColumn(id);
      return res.json({ message: "Column deleted" });
    } catch (error) {
      console.error("Error deleting column:", error);
      return res.status(500).json({ message: "Error deleting column" });
    }
  });

  app.patch("/api/columns/:id/assign-gpt", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { gptAssigned, gptName, apiKey, gptInstructions, autoTrigger } = req.body;
      
      const column = await storage.updateColumn(id, { 
        gptAssigned, 
        gptName, 
        apiKey, 
        gptInstructions, 
        autoTrigger
      });
      
      if (!column) {
        return res.status(404).json({ message: "Column not found" });
      }
      
      return res.json(column);
    } catch (error) {
      console.error("Error assigning GPT to column:", error);
      return res.status(500).json({ message: "Error assigning GPT to column" });
    }
  });

  app.patch("/api/columns/:id/reorder-cards", async (req, res) => {
    try {
      const columnId = parseInt(req.params.id);
      const { updates } = req.body;
      
      if (!Array.isArray(updates)) {
        return res.status(400).json({ message: "Updates must be an array" });
      }
      
      await storage.reorderCards(columnId, updates);
      return res.json({ message: "Cards reordered" });
    } catch (error) {
      console.error("Error reordering cards:", error);
      return res.status(500).json({ message: "Error reordering cards" });
    }
  });

  // CARD ROUTES
  app.post("/api/cards", async (req, res) => {
    try {
      const data = insertCardSchema.parse({
        ...req.body,
        order: 999 // Will be updated by the storage layer
      });
      
      const card = await storage.createCard(data);
      return res.status(201).json(card);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: fromZodError(error).details 
        });
      }
      console.error("Error creating card:", error);
      return res.status(500).json({ message: "Error creating card" });
    }
  });

  app.patch("/api/cards/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { title, description } = req.body;
      
      const card = await storage.updateCard(id, { title, description });
      
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      return res.json(card);
    } catch (error) {
      console.error("Error updating card:", error);
      return res.status(500).json({ message: "Error updating card" });
    }
  });

  app.delete("/api/cards/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCard(id);
      return res.json({ message: "Card deleted" });
    } catch (error) {
      console.error("Error deleting card:", error);
      return res.status(500).json({ message: "Error deleting card" });
    }
  });

  app.patch("/api/cards/:id/move", async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const { destinationColumnId, position } = req.body;
      
      const card = await storage.moveCard(cardId, parseInt(destinationColumnId), position);
      
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Check if destination column has GPT assigned and auto-trigger is enabled
      const column = await storage.getColumnById(parseInt(destinationColumnId));
      
      if (column && column.gptAssigned && column.autoTrigger) {
        // Mark card as processing
        await storage.updateCard(cardId, { 
          processing: true,
          gptOutput: null // Clear previous output while processing
        });
        
        // Return response immediately so UI isn't blocked
        res.json(card);
        
        // Trigger GPT processing after response is sent
        try {
          // Use setTimeout to allow the transaction to commit fully before starting processing
          setTimeout(async () => {
            try {
              await triggerGPTProcessing(cardId, column);
            } catch (error) {
              console.error("Error processing card with GPT:", error);
              // Ensure the card is marked as not processing even if there's an error
              await storage.updateCard(cardId, { processing: false });
            }
          }, 100);
        } catch (error) {
          console.error("Error scheduling GPT processing:", error);
          // Ensure the card is marked as not processing if scheduling fails
          await storage.updateCard(cardId, { processing: false });
        }
        
        return; // Already sent response
      }
      
      return res.json(card);
    } catch (error) {
      console.error("Error moving card:", error);
      return res.status(500).json({ message: "Error moving card" });
    }
  });

  app.post("/api/cards/:id/trigger-gpt", async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const card = await storage.getCardById(cardId);
      
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      const column = await storage.getColumnById(card.columnId);
      
      if (!column || !column.gptAssigned) {
        return res.status(400).json({ message: "Column has no GPT assigned" });
      }
      
      // Mark card as processing and clear previous output
      await storage.updateCard(cardId, { 
        processing: true,
        gptOutput: null
      });
      
      // Return response immediately
      res.json({ message: "GPT processing triggered" });
      
      // Trigger GPT processing after response is sent
      try {
        // Use setTimeout to allow the transaction to commit fully before starting processing
        setTimeout(async () => {
          try {
            await triggerGPTProcessing(cardId, column);
          } catch (error) {
            console.error("Error processing card with GPT:", error);
            // Ensure the card is marked as not processing even if there's an error
            await storage.updateCard(cardId, { processing: false });
          }
        }, 100);
      } catch (error) {
        console.error("Error scheduling GPT processing:", error);
        // Ensure the card is marked as not processing if scheduling fails
        await storage.updateCard(cardId, { processing: false });
      }
      
      return;
    } catch (error) {
      console.error("Error triggering GPT processing:", error);
      return res.status(500).json({ message: "Error triggering GPT processing" });
    }
  });

  // CHAT ROUTES
  app.post("/api/chats", async (req, res) => {
    try {
      // Parse the request body without timestamp, let database handle it
      const chatData = insertChatSchema.parse(req.body);
      
      // Create user chat message
      const chat = await storage.createChat(chatData);
      
      // Get card and column
      const card = await storage.getCardById(chatData.cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      const column = await storage.getColumnById(card.columnId);
      if (!column || !column.gptAssigned) {
        return res.status(400).json({ message: "Column has no GPT assigned" });
      }
      
      // Mark card as processing while GPT is generating a response
      await storage.updateCard(chatData.cardId, { processing: true });
      
      // Return response immediately
      res.status(201).json(chat);
      
      // Process the chat message with GPT after response is sent
      try {
        await processChat(chatData.cardId, chatData.content, column);
      } catch (error) {
        console.error("Error processing chat with GPT:", error);
        // Make sure processing flag is cleared even if there's an error
        await storage.updateCard(chatData.cardId, { processing: false });
      }
      
      return;
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: fromZodError(error).details 
        });
      }
      console.error("Error creating chat:", error);
      return res.status(500).json({ message: "Error creating chat" });
    }
  });

  // ATTACHMENT ROUTES
  // Upload a new attachment to a card
  app.post("/api/cards/:cardId/attachments", upload.single('file'), async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId);
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No file provided" });
      }
      
      // Get card to verify it exists
      const card = await storage.getCardById(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Read file content as base64
      const fileContent = fs.readFileSync(file.path).toString('base64');
      
      // Create attachment
      const attachment = await storage.createAttachment({
        cardId,
        filename: file.originalname,
        fileType: file.mimetype,
        content: fileContent
      });
      
      // Delete temp file
      fs.unlinkSync(file.path);
      
      return res.status(201).json(attachment);
    } catch (error) {
      console.error("Error uploading attachment:", error);
      return res.status(500).json({ message: "Error uploading attachment" });
    }
  });
  
  // Get attachment by ID
  app.get("/api/attachments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Use 0 as a placeholder for cardId since we're fetching by attachment ID
      const attachments = await storage.getAttachmentsByCardId(0, id);
      
      if (!attachments || attachments.length === 0) {
        return res.status(404).json({ message: "Attachment not found" });
      }
      
      const attachment = attachments[0];
      
      // If it's an image, serve it as an image
      if (attachment.fileType.startsWith('image/')) {
        const imageBuffer = Buffer.from(attachment.content, 'base64');
        res.set('Content-Type', attachment.fileType);
        return res.send(imageBuffer);
      }
      
      // For other file types, return the attachment object
      return res.json(attachment);
    } catch (error) {
      console.error("Error fetching attachment:", error);
      return res.status(500).json({ message: "Error fetching attachment" });
    }
  });
  
  app.delete("/api/attachments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAttachment(id);
      return res.json({ message: "Attachment deleted" });
    } catch (error) {
      console.error("Error deleting attachment:", error);
      return res.status(500).json({ message: "Error deleting attachment" });
    }
  });
  
  // Generate an image with DALL-E and attach to a card
  app.post("/api/cards/:cardId/generate-image", async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId);
      const { prompt, apiKey } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ message: "No prompt provided" });
      }
      
      // Get card to verify it exists
      const card = await storage.getCardById(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      // Generate the image
      const imageUrl = await generateImage(prompt, apiKey || undefined);
      
      if (!imageUrl) {
        return res.status(500).json({ message: "Failed to generate image" });
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
      
      return res.status(201).json(attachment);
    } catch (error) {
      console.error("Error generating image:", error);
      return res.status(500).json({ 
        message: "Error generating image",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // CARD PROCESSING STATUS ENDPOINT
  app.get("/api/cards/:id/processing-status", async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const card = await storage.getCardById(cardId);
      
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Get the latest chat data if available
      let chats = card.chats || [];
      
      // Check if the card has processing errors (indicated by error prefix in gptOutput)
      const processingError = card.gptOutput?.startsWith("Error processing with GPT:") 
        ? card.gptOutput 
        : null;
      
      // Enhanced response with error status
      const response = { 
        processing: card.processing || false,
        gptOutput: card.gptOutput,
        processingError,
        chats: await Promise.all(chats.map(async chat => {
          // Log the original chat data to see what's coming from the database
          console.log(`DEBUG - Chat original data for chat ${chat.id}:`, {
            role: chat.role,
            gptName: chat.gptName,
            gptColor: chat.gptColor,
            cardId: chat.cardId,
            timestamp: chat.timestamp
          });
          
          // For all chats, ensure timestamp is present
          let updatedChat = {
            ...chat,
            timestamp: chat.timestamp || new Date().toISOString()
          };
          
          // Only process assistant messages with missing GPT info
          if (chat.role === 'assistant' && (!chat.gptName || !chat.gptColor)) {
            try {
              // Try to find which column the message was created in based on timestamp
              // This ensures older messages display with their original GPT info
              // even if the card has been moved between columns
              
              // First, find the column where the card was located when this chat was created
              const messageTimestamp = new Date(chat.timestamp || new Date().toISOString());
              
              // For existing messages without GPT metadata, use the current column as fallback
              const originalColumn = await storage.getColumnById(card.columnId);
              console.log(`DEBUG - Using column for chat ${chat.id}:`, {
                columnId: card.columnId,
                columnGptName: originalColumn?.gptName,
                columnGptColor: originalColumn?.gptColor
              });
              
              // Add GPT metadata based on original column settings
              // IMPORTANT: Only use fallback if the original is null/undefined, not empty string
              updatedChat = {
                ...updatedChat,
                gptName: chat.gptName !== null && chat.gptName !== undefined ? chat.gptName : (originalColumn?.gptName || 'AI Assistant'),
                gptColor: chat.gptColor !== null && chat.gptColor !== undefined ? chat.gptColor : (originalColumn?.gptColor || null)
              };
            } catch (error) {
              console.error("Error finding original column for chat:", error);
              // Fallback to minimum defaults if anything fails
              updatedChat = {
                ...updatedChat,
                gptName: chat.gptName || 'AI Assistant',
                gptColor: chat.gptColor || 'Peach'
              };
            }
          }
          
          // Log the updated chat data to see what's being sent to the frontend
          console.log(`DEBUG - Chat after processing ${chat.id}:`, {
            role: updatedChat.role,
            gptName: updatedChat.gptName,
            gptColor: updatedChat.gptColor
          });
          
          return updatedChat;
        })),
        attachments: card.attachments || [],
        updatedAt: new Date().toISOString() // Add timestamp for clients to track freshness
      };
      
      return res.json(response);
    } catch (error) {
      console.error("Error getting card processing status:", error);
      return res.status(500).json({ 
        message: "Error getting card processing status",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
