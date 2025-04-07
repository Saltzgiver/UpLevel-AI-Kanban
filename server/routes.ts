import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { triggerGPTProcessing, processChat } from "./openai";
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
      const chatData = insertChatSchema.parse({
        ...req.body,
        // Add timestamp to new chats if not provided
        timestamp: req.body.timestamp || new Date().toISOString()
      });
      
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
      
      // Enhance the response to include timestamps
      const response = { 
        processing: card.processing || false,
        gptOutput: card.gptOutput,
        chats: chats.map(chat => ({
          ...chat,
          // Ensure timestamp is present for all chats
          timestamp: chat.timestamp || new Date().toISOString()
        })),
        attachments: card.attachments || [],
        updatedAt: new Date().toISOString() // Add timestamp for clients to track freshness
      };
      
      return res.json(response);
    } catch (error) {
      console.error("Error getting card processing status:", error);
      return res.status(500).json({ message: "Error getting card processing status" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
