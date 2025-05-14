import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { triggerGPTProcessing, processChat, generateImage, getPromptSuggestion } from "./openai";
import { insertBoardSchema, insertColumnSchema, insertCardSchema, insertChatSchema, insertSettingsSchema } from "@shared/schema";
import { z } from "zod";
import { ZodError } from "zod";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fromZodError } from "zod-validation-error";
import { storeSuggestion, checkSuggestion, clearSuggestion, dumpCache } from "./suggestionCache";
import { registerMcpRoutes } from "./routes/mcp";
import { WebSocketServer, WebSocket } from "ws";
import { generateWorkflowColumns } from "./workflowGenerator";
import { DEFAULT_SYSTEM_PROMPT } from "./workflowGenerator";

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

// Configure multer for file uploads with error handling
const multerStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: multerStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB size limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now
    cb(null, true);
  }
});

import { registerWorkflowRoutes } from "./routes/workflow";

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

  // SETTINGS ROUTES
  app.get("/api/settings/:key", async (req, res) => {
    try {
      const { key } = req.params;
      const setting = await storage.getSetting(key);
      
      // Special handling for workflow_system_prompt
      if (!setting && key === "workflow_system_prompt") {
        // Return the default prompt when the setting doesn't exist
        return res.json({ 
          id: 0, 
          key: "workflow_system_prompt", 
          value: DEFAULT_SYSTEM_PROMPT,
          updatedAt: new Date()
        });
      }
      
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      
      return res.json(setting);
    } catch (error) {
      console.error("Error fetching setting:", error);
      return res.status(500).json({ message: "Error fetching setting" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const { key, value } = req.body;
      
      if (!key || typeof value !== 'string') {
        return res.status(400).json({ message: "Key and value are required. Value must be a string." });
      }
      
      const data = { key, value };
      const validatedData = insertSettingsSchema.parse(data);
      // Ensure value is a string with fallback to empty string if validation somehow passes null/undefined
      const setting = await storage.createOrUpdateSetting(
        validatedData.key, 
        validatedData.value || ""
      );
      
      return res.status(201).json(setting);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: fromZodError(error).details 
        });
      }
      console.error("Error creating or updating setting:", error);
      return res.status(500).json({ message: "Error creating or updating setting" });
    }
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
      console.log("POST /api/boards - Request body:", req.body);
      
      const data = insertBoardSchema.parse(req.body);
      console.log("Board data validated successfully:", data);
      
      const board = await storage.createBoard(data);
      console.log("Board created successfully:", board);
      
      return res.status(201).json(board);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        console.error("Validation error creating board:", validationError);
        return res.status(400).json({ 
          message: "Validation error", 
          errors: validationError.details 
        });
      }
      console.error("Error creating board:", error);
      
      // Provide more detailed error information to help diagnose the issue
      const errorResponse = {
        message: "Error creating board",
        details: error instanceof Error ? error.message : "Unknown error"
      };
      
      return res.status(500).json(errorResponse);
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
  
  app.delete("/api/boards/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if the board exists
      const board = await storage.getBoardById(id);
      if (!board) {
        return res.status(404).json({ message: "Board not found" });
      }
      
      // Delete the board and all associated columns and cards
      await storage.deleteBoard(id);
      
      return res.json({ message: "Board deleted successfully" });
    } catch (error) {
      console.error("Error deleting board:", error);
      return res.status(500).json({ message: "Error deleting board" });
    }
  });

  // COLUMN ROUTES
  app.get("/api/columns/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const column = await storage.getColumnById(id);
      
      if (!column) {
        return res.status(404).json({ message: "Column not found" });
      }
      
      return res.json(column);
    } catch (error) {
      console.error("Error retrieving column:", error);
      return res.status(500).json({ message: "Error retrieving column" });
    }
  });

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
  
  // Enable/disable MCP for a column
  app.patch("/api/columns/:id/mcp-settings", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { mcpEnabled, mcpAutoTrigger } = req.body;
      
      // Get the column first to check if it exists
      const existingColumn = await storage.getColumnById(id);
      if (!existingColumn) {
        return res.status(404).json({ message: "Column not found" });
      }
      
      // Update only the MCP-related settings
      const column = await storage.updateColumn(id, { 
        mcpEnabled: mcpEnabled !== undefined ? mcpEnabled : existingColumn.mcpEnabled,
        mcpAutoTrigger: mcpAutoTrigger !== undefined ? mcpAutoTrigger : existingColumn.mcpAutoTrigger
      });
      
      return res.json({
        message: "MCP settings updated successfully",
        column
      });
    } catch (error) {
      console.error("Error updating MCP settings:", error);
      return res.status(500).json({ message: "Error updating MCP settings" });
    }
  });
  
  // Get a specific column
  app.get("/api/columns/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const column = await storage.getColumnById(id);
      
      if (!column) {
        return res.status(404).json({ message: "Column not found" });
      }
      
      return res.json(column);
    } catch (error) {
      console.error("Error fetching column:", error);
      return res.status(500).json({ message: "Error fetching column" });
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
      const { gptAssigned, gptName, apiKey, gptInstructions, gptColor, autoTrigger } = req.body;
      
      // For GPT-assigned columns, use "from_env" as the default API key if not specified
      let updatedApiKey = apiKey;
      if (gptAssigned && !updatedApiKey) {
        updatedApiKey = "from_env";
        console.log(`Setting default 'from_env' API key for GPT-assigned column ${id}`);
      }
      
      const column = await storage.updateColumn(id, { 
        gptAssigned, 
        gptName, 
        apiKey: updatedApiKey, 
        gptInstructions,
        gptColor, 
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
  
  // Prompt Assistant endpoints
  
  // Retrieve or generate a prompt suggestion for a column and card
  app.post("/api/columns/:id/prompt-suggestion", async (req, res) => {
    try {
      const columnId = parseInt(req.params.id);
      const { cardId } = req.body;
      
      if (!cardId) {
        return res.status(400).json({ message: "Card ID is required" });
      }
      
      console.log(`Retrieving/generating prompt suggestion for column ${columnId} and card ${cardId}`);
      
      // First check if there's already a cached suggestion
      const cachedSuggestion = checkSuggestion(columnId, cardId);
      
      if (cachedSuggestion?.hasSuggestion && cachedSuggestion.suggestion) {
        // Handle the cached suggestion based on its type
        if (typeof cachedSuggestion.suggestion === 'string') {
          // If it's a string from an older implementation, convert to the new format
          return res.json({ 
            suggestion: {
              rationale: "Suggested improvements for column instructions",
              suggestedInstructions: cachedSuggestion.suggestion as string
            } 
          });
        } else {
          // If it's already in the structured format, return it directly
          return res.json({ suggestion: cachedSuggestion.suggestion });
        }
      }
      
      // If no cached suggestion, we need to fetch the necessary data and generate one
      // 1. Get column details to get the API key and current instructions
      const column = await storage.getColumnById(columnId);
      if (!column) {
        return res.status(404).json({ message: "Column not found" });
      }
      
      // 2. Get card details
      const card = await storage.getCardById(parseInt(cardId));
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // 3. Get chat history for the card
      const chats = await storage.getChatsByCardId(parseInt(cardId));
      
      // 4. Create card context object
      const cardContext = {
        title: card.title,
        description: card.description,
        attachments: card.attachments || []
      };
      
      // 5. Call getPromptSuggestion with the required data
      const suggestion = await getPromptSuggestion(
        column.gptInstructions || "",
        cardContext,
        chats,
        column.apiKey || undefined
      );
      
      // Return the suggestion (which may be null if no improvement is found)
      return res.json({ suggestion });
      
    } catch (error) {
      console.error("Error generating prompt suggestion:", error);
      return res.status(500).json({ 
        message: "Error generating prompt suggestion",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Check if a prompt suggestion is available for a column
  app.get("/api/columns/:id/prompt-suggestion/status", async (req, res) => {
    try {
      const columnId = parseInt(req.params.id);
      console.log(`Checking suggestion status for column ${columnId}`);
      
      const status = checkSuggestion(columnId);
      
      return res.json({
        hasSuggestion: status?.hasSuggestion || false
      });
    } catch (error) {
      console.error("Error checking suggestion status:", error);
      return res.status(500).json({ message: "Error checking suggestion status" });
    }
  });
  
  // Check if a prompt suggestion is available for a specific card in a column
  app.get("/api/columns/:id/prompt-suggestion/status/:cardId", async (req, res) => {
    try {
      const columnId = parseInt(req.params.id);
      const cardId = parseInt(req.params.cardId);
      console.log(`[PROMPT ASSISTANT] Checking suggestion status for column ${columnId} and card ${cardId}`);
      
      // First dump the current cache for debugging
      dumpCache();
      
      const status = checkSuggestion(columnId, cardId);
      
      console.log(`[PROMPT ASSISTANT] Suggestion status: ${JSON.stringify(status || { hasSuggestion: false })}`);
      
      const result = {
        hasSuggestion: status?.hasSuggestion || false
      };
      
      console.log(`[PROMPT ASSISTANT] Returning status: ${JSON.stringify(result)}`);
      
      return res.json(result);
    } catch (error) {
      console.error("[PROMPT ASSISTANT] Error checking suggestion status for card:", error);
      return res.status(500).json({ message: "Error checking suggestion status for card" });
    }
  });
  
  // Check if a suggestion is available for a specific column+card combo
  // This is a more reliable endpoint that ensures JSON responses
  app.get("/api/columns/:id/prompt-suggestion/check/:cardId", async (req, res) => {
    try {
      const columnId = parseInt(req.params.id);
      const cardId = parseInt(req.params.cardId);
      
      console.log(`[PROMPT ASSISTANT] Checking suggestion for column ${columnId} and card ${cardId}`);
      
      // Get current status
      const status = checkSuggestion(columnId, cardId);
      
      // Set correct content type to ensure JSON response
      res.set('Content-Type', 'application/json');
      
      // Return the status (without the actual suggestion for efficiency)
      return res.status(200).json({
        hasSuggestion: !!(status && status.hasSuggestion),
        timestamp: Date.now(), // Use current timestamp instead of from status to avoid type errors
        cardId: cardId,
        columnId: columnId
      });
    } catch (error) {
      console.error("Error checking prompt suggestion:", error);
      
      // Even on error, ensure we return JSON
      res.set('Content-Type', 'application/json');
      return res.status(500).json({ 
        error: true,
        message: "Error checking prompt suggestion",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get the actual suggestion content for a column and specific card
  app.get("/api/columns/:id/prompt-suggestion/:cardId", async (req, res) => {
    try {
      const columnId = parseInt(req.params.id);
      const cardId = parseInt(req.params.cardId);
      
      console.log(`[PROMPT ASSISTANT] Retrieving suggestion for column ${columnId} and card ${cardId}`);
      
      // Explicitly set content type to JSON
      res.setHeader('Content-Type', 'application/json');
      
      const status = checkSuggestion(columnId, cardId);
      
      if (!status || !status.hasSuggestion) {
        return res.status(404).json({ message: "No suggestion available for this column and card" });
      }
      
      // Get current column data to include with the response
      const column = await storage.getColumnById(columnId);
      if (!column) {
        return res.status(404).json({ message: "Column not found" });
      }
      
      // Format response based on suggestion type
      if (typeof status.suggestion === 'string') {
        return res.json({
          suggestion: {
            rationale: "Suggested improvements for column instructions",
            suggestedInstructions: status.suggestion
          }
        });
      } else if (status.suggestion && typeof status.suggestion === 'object') {
        // Handle structured suggestion format
        console.log(`[PROMPT ASSISTANT] Returning structured suggestion:`, status.suggestion);
        return res.json({
          suggestion: status.suggestion
        });
      } else {
        return res.json({
          suggestion: null
        });
      }
    } catch (error) {
      console.error("[PROMPT ASSISTANT] Error retrieving suggestion for card:", error);
      // Set content type even on error
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ message: "Error retrieving suggestion for card" });
    }
  });
  
  // Get the actual suggestion content for a column
  app.get("/api/columns/:id/prompt-suggestion", async (req, res) => {
    try {
      const columnId = parseInt(req.params.id);
      console.log(`Retrieving suggestion for column ${columnId}`);
      
      // Explicitly set content type to JSON
      res.setHeader('Content-Type', 'application/json');
      
      const status = checkSuggestion(columnId);
      
      if (!status || !status.hasSuggestion) {
        return res.status(404).json({ message: "No suggestion available for this column" });
      }
      
      // Get current column data to include with the response
      const column = await storage.getColumnById(columnId);
      if (!column) {
        return res.status(404).json({ message: "Column not found" });
      }
      
      // Format response based on suggestion type
      if (typeof status.suggestion === 'string') {
        return res.json({
          currentInstructions: column.gptInstructions || "",
          suggestedInstructions: status.suggestion || "",
          timestamp: Date.now()
        });
      } else if (status.suggestion && typeof status.suggestion === 'object') {
        // Handle structured suggestion format
        console.log(`[PROMPT ASSISTANT] Returning structured suggestion for column:`, status.suggestion);
        return res.json({
          currentInstructions: column.gptInstructions || "",
          suggestedInstructions: status.suggestion.suggestedInstructions,
          rationale: status.suggestion.rationale,
          timestamp: Date.now()
        });
      } else {
        return res.json({
          currentInstructions: column.gptInstructions || "",
          suggestedInstructions: "",
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error("Error retrieving suggestion:", error);
      // Set content type even on error
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ message: "Error retrieving suggestion" });
    }
  });
  
  // Accept a suggestion and update the column's instructions
  app.post("/api/columns/:id/prompt-suggestion/accept", async (req, res) => {
    try {
      const columnId = parseInt(req.params.id);
      console.log(`Accepting suggestion for column ${columnId}`);
      
      // Get the suggestion
      const status = checkSuggestion(columnId);
      
      if (!status || !status.hasSuggestion) {
        return res.status(404).json({ message: "No suggestion available for this column" });
      }
      
      // Optional - allow overriding the suggestion with edited text
      const { instructions } = req.body;
      let updatedInstructions = instructions;
      
      // If no explicit instructions provided, use the suggestion
      if (!updatedInstructions) {
        if (typeof status.suggestion === 'string') {
          updatedInstructions = status.suggestion;
        } else if (status.suggestion && typeof status.suggestion === 'object') {
          updatedInstructions = status.suggestion.suggestedInstructions;
        }
      }
      
      if (!updatedInstructions) {
        return res.status(400).json({ message: "No instructions provided and no suggestion available" });
      }
      
      // Update the column with the new instructions
      const column = await storage.updateColumn(columnId, { 
        gptInstructions: updatedInstructions 
      });
      
      if (!column) {
        return res.status(404).json({ message: "Column not found" });
      }
      
      // Clear the suggestion from cache as it's been accepted
      clearSuggestion(columnId);
      
      return res.json({
        message: "Suggestion accepted and column updated",
        column
      });
    } catch (error) {
      console.error("Error accepting suggestion:", error);
      return res.status(500).json({ message: "Error accepting suggestion" });
    }
  });
  
  // Accept a card-specific suggestion and update the column's instructions
  app.post("/api/columns/:id/prompt-suggestion/accept/:cardId", async (req, res) => {
    try {
      const columnId = parseInt(req.params.id);
      const cardId = parseInt(req.params.cardId);
      
      console.log(`[PROMPT ASSISTANT] Accepting suggestion for column ${columnId} and card ${cardId}`);
      
      // Get the suggestion
      const status = checkSuggestion(columnId, cardId);
      
      if (!status || !status.hasSuggestion) {
        return res.status(404).json({ message: "No suggestion available for this column and card" });
      }
      
      // Optional - allow overriding the suggestion with edited text
      const { instructions } = req.body;
      let updatedInstructions = instructions;
      
      // If no explicit instructions provided, use the suggestion
      if (!updatedInstructions) {
        if (typeof status.suggestion === 'string') {
          updatedInstructions = status.suggestion;
        } else if (status.suggestion && typeof status.suggestion === 'object') {
          updatedInstructions = status.suggestion.suggestedInstructions;
        }
      }
      
      if (!updatedInstructions) {
        return res.status(400).json({ message: "No instructions provided and no suggestion available" });
      }
      
      // Update the column with the new instructions
      const column = await storage.updateColumn(columnId, { 
        gptInstructions: updatedInstructions 
      });
      
      if (!column) {
        return res.status(404).json({ message: "Column not found" });
      }
      
      // Clear the suggestion from cache as it's been accepted
      clearSuggestion(columnId, cardId);
      
      return res.json({
        message: "Card-specific suggestion accepted and column updated",
        column
      });
    } catch (error) {
      console.error("[PROMPT ASSISTANT] Error accepting card-specific suggestion:", error);
      return res.status(500).json({ message: "Error accepting card-specific suggestion" });
    }
  });
  
  // Reject a suggestion
  app.post("/api/columns/:id/prompt-suggestion/reject", async (req, res) => {
    try {
      const columnId = parseInt(req.params.id);
      console.log(`Rejecting suggestion for column ${columnId}`);
      
      // Clear the suggestion from cache
      clearSuggestion(columnId);
      
      return res.json({
        message: "Suggestion rejected and cleared"
      });
    } catch (error) {
      console.error("Error rejecting suggestion:", error);
      return res.status(500).json({ message: "Error rejecting suggestion" });
    }
  });
  
  // Reject a card-specific suggestion
  app.post("/api/columns/:id/prompt-suggestion/reject/:cardId", async (req, res) => {
    try {
      const columnId = parseInt(req.params.id);
      const cardId = parseInt(req.params.cardId);
      
      console.log(`[PROMPT ASSISTANT] Rejecting suggestion for column ${columnId} and card ${cardId}`);
      
      // Clear the suggestion from cache
      clearSuggestion(columnId, cardId);
      
      return res.json({
        message: "Card-specific suggestion rejected and cleared"
      });
    } catch (error) {
      console.error("[PROMPT ASSISTANT] Error rejecting card-specific suggestion:", error);
      return res.status(500).json({ message: "Error rejecting card-specific suggestion" });
    }
  });
  
  // Create a test suggestion (for testing only)
  app.post("/api/columns/:id/prompt-suggestion/create-test/:cardId", async (req, res) => {
    try {
      const columnId = parseInt(req.params.id);
      const cardId = parseInt(req.params.cardId);
      const { suggestion } = req.body;
      
      // Verify the column exists
      const column = await storage.getColumnById(columnId);
      if (!column) {
        return res.status(404).json({ message: "Column not found" });
      }
      
      console.log(`[PROMPT ASSISTANT] Creating test suggestion for column ${columnId}, card ${cardId}`);
      console.log(`[PROMPT ASSISTANT] Suggestion:`, suggestion);
      
      // Store the suggestion in the cache
      storeSuggestion(columnId, cardId, suggestion);
      
      return res.json({
        message: "Test suggestion created",
        columnId,
        cardId,
        suggestion
      });
    } catch (error) {
      console.error("[PROMPT ASSISTANT] Error creating test suggestion:", error);
      return res.status(500).json({ message: "Error creating test suggestion" });
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
      const { title, description, processing, includeChatHistory } = req.body;
      
      const card = await storage.updateCard(id, { 
        ...(title !== undefined && { title }), 
        ...(description !== undefined && { description }),
        ...(processing !== undefined && { processing }),
        ...(includeChatHistory !== undefined && { includeChatHistory })
      });
      
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
      const { destinationColumnId, position, sourceColumnId } = req.body;
      
      console.log(`[PROMPT ASSISTANT] Card ${cardId} move request: from column ${sourceColumnId} to column ${destinationColumnId}`);
      
      const card = await storage.moveCard(cardId, parseInt(destinationColumnId), position);
      
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Get the source column to potentially analyze for prompt suggestions
      const sourceColumn = sourceColumnId ? await storage.getColumnById(parseInt(sourceColumnId)) : null;
      
      // Enhance the card object with source column name for the frontend interceptor
      const enhancedCard = {
        ...card,
        sourceColumnName: sourceColumn?.name || null
      };
      
      // Log debug information about the current suggestion cache
      console.log('[PROMPT ASSISTANT] Current cache state before suggestion generation:');
      dumpCache();
      
      // Check if destination column has GPT assigned and auto-trigger is enabled
      const destColumn = await storage.getColumnById(parseInt(destinationColumnId));
      
      // If the card is moved from one GPT column to another, analyze for prompt improvement suggestions
      if (sourceColumn && sourceColumn.gptAssigned) {
        console.log(`[PROMPT ASSISTANT] Card ${cardId} moved from column ${sourceColumn.id} (${sourceColumn.name}) - Analyzing for suggestions`);
        
        // Run this analysis asynchronously so it doesn't block the main flow
        setTimeout(async () => {
          try {
            // Get the card details for analysis
            const cardWithDetails = await storage.getCardById(cardId);
            if (!cardWithDetails) {
              console.log(`[PROMPT ASSISTANT] Card ${cardId} not found for suggestion analysis`);
              return;
            }
            
            // Get the chats from the card while it was in the source column
            const chats = await storage.getChatsByCardId(cardId);
            console.log(`[PROMPT ASSISTANT] Found ${chats.length} chats for analysis for card ${cardId}`);
            
            if (!chats || chats.length === 0) {
              // No chats to analyze, store no suggestion available in cache
              console.log(`[PROMPT ASSISTANT] No chats found for card ${cardId}, storing null suggestion`);
              storeSuggestion(sourceColumn.id, cardId, null);
              return;
            }
            
            // Create card context object for analysis
            const cardContext = {
              title: cardWithDetails.title,
              description: cardWithDetails.description,
              attachments: cardWithDetails.attachments || []
            };
            
            console.log(`[PROMPT ASSISTANT] Calling getPromptSuggestion for column ${sourceColumn.id}, card ${cardId}`);
            
            // Get prompt improvement suggestion
            const promptSuggestion = await getPromptSuggestion(
              sourceColumn.gptInstructions || "", 
              cardContext,
              chats,
              sourceColumn.apiKey || undefined
            );
            
            // Store the suggestion in the cache
            console.log(`[PROMPT ASSISTANT] Storing suggestion for column ${sourceColumn.id}, card ${cardId}: ${promptSuggestion ? 'Available' : 'None available'}`);
            storeSuggestion(sourceColumn.id, cardId, promptSuggestion);
            
            console.log(`[PROMPT ASSISTANT] Prompt suggestion for column ${sourceColumn.id}: ${promptSuggestion ? 'Available' : 'None available'}`);
            if (promptSuggestion) {
              // Log a preview of the suggestion content
              const suggestedInstructions = promptSuggestion.suggestedInstructions;
              console.log(`[PROMPT ASSISTANT] Suggestion content: ${suggestedInstructions.substring(0, 100)}${suggestedInstructions.length > 100 ? '...' : ''}`);
            }
          } catch (error) {
            console.error("Error generating prompt suggestion:", error);
            // Store no suggestion available in case of error
            storeSuggestion(sourceColumn.id, cardId, null);
          }
        }, 200);
      }
      
      if (destColumn && destColumn.gptAssigned && destColumn.autoTrigger) {
        // Mark card as processing
        await storage.updateCard(cardId, { 
          processing: true,
          gptOutput: null // Clear previous output while processing
        });
        
        // Return response immediately so UI isn't blocked
        res.json(enhancedCard);
        
        // Trigger GPT processing after response is sent
        try {
          // Use setTimeout to allow the transaction to commit fully before starting processing
          setTimeout(async () => {
            try {
              await triggerGPTProcessing(cardId, destColumn);
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
      
      return res.json(enhancedCard);
    } catch (error) {
      console.error("Error moving card:", error);
      return res.status(500).json({ message: "Error moving card" });
    }
  });

  app.post("/api/cards/:id/trigger-gpt", async (req, res) => {
    try {
      console.log(`=== PROCESSING CARD WITH GPT - START ===`);
      const cardId = parseInt(req.params.id);
      console.log(`Card ID: ${cardId}`);
      
      const card = await storage.getCardById(cardId);
      
      if (!card) {
        console.log(`Card ${cardId} not found`);
        return res.status(404).json({ message: "Card not found" });
      }
      
      console.log(`Card found: ${card.title} - Getting column ${card.columnId}`);
      const column = await storage.getColumnById(card.columnId);
      
      if (!column) {
        console.log(`Column ${card.columnId} not found`);
        return res.status(400).json({ message: "Column not found" });
      }
      
      if (!column.gptAssigned) {
        console.log(`Column ${column.id} (${column.name}) has no GPT assigned`);
        return res.status(400).json({ message: "Column has no GPT assigned" });
      }
      
      console.log(`Column ${column.id} (${column.name}) has GPT assigned: ${column.gptName}`);
      console.log(`API Key type: ${column.apiKey === "from_env" ? "Using environment variable" : "Using custom key"}`);
      
      // Mark card as processing and clear previous output
      console.log(`Marking card ${cardId} as processing`);
      await storage.updateCard(cardId, { 
        processing: true,
        gptOutput: null
      });
      
      // Return response immediately
      console.log(`Sending response to client`);
      res.json({ message: "GPT processing triggered" });
      
      // Trigger GPT processing after response is sent
      try {
        // Use setTimeout to allow the transaction to commit fully before starting processing
        console.log(`Scheduling GPT processing with setTimeout`);
        setTimeout(async () => {
          try {
            console.log(`=== Executing triggerGPTProcessing for card ${cardId} ===`);
            console.log(`Environment OPENAI_API_KEY available: ${process.env.OPENAI_API_KEY ? "YES (length: " + process.env.OPENAI_API_KEY.length + ")" : "NO"}`);
            await triggerGPTProcessing(cardId, column);
            console.log(`=== triggerGPTProcessing for card ${cardId} - COMPLETE ===`);
          } catch (error) {
            console.error(`=== ERROR processing card ${cardId} with GPT ===`, error);
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
    console.log("POST /api/chats - Processing new chat message");
    try {
      // Parse the request body without timestamp, let database handle it
      const chatData = insertChatSchema.parse(req.body);
      
      // Create user chat message
      const chat = await storage.createChat(chatData);
      console.log(`Created chat message for card ${chatData.cardId}`);
      
      // Get card and column
      const card = await storage.getCardById(chatData.cardId);
      if (!card) {
        console.log(`Card ${chatData.cardId} not found`);
        return res.status(404).json({ message: "Card not found" });
      }
      
      const column = await storage.getColumnById(card.columnId);
      if (!column || !column.gptAssigned) {
        console.log(`Column ${card.columnId} has no GPT assigned`);
        return res.status(400).json({ message: "Column has no GPT assigned" });
      }
      
      // Define image request patterns
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
      
      // Check if the message content matches any image request pattern
      const isImageRequest = imageRequestPatterns.some(pattern => 
        pattern.test(chatData.content)
      );
      
      if (isImageRequest) {
        console.log(`Image generation request detected in message: "${chatData.content.substring(0, 50)}${chatData.content.length > 50 ? '...' : ''}"`);
        console.log(`Checking if column ${column.id} is GPT-assigned: ${column.gptAssigned}`);
      }
      
      // Mark card as processing while GPT is generating a response
      await storage.updateCard(chatData.cardId, { processing: true });
      console.log(`Set processing flag to true for card ${chatData.cardId}`);
      
      // Return response immediately
      res.status(201).json(chat);
      
      // Process the chat message with GPT after response is sent
      try {
        if (isImageRequest && column.gptAssigned) {
          console.log(`Triggering GPT processing for image generation request - Card ${chatData.cardId}`);
          await triggerGPTProcessing(chatData.cardId, column);
        } else {
          // Standard text processing
          console.log(`Triggering standard chat processing - Card ${chatData.cardId}`);
          await processChat(chatData.cardId, chatData.content, column);
        }
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
  // Custom error handler for multer
  const handleMulterErrors = (err: any, req: any, res: any, next: any) => {
    console.error("Multer error:", err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        message: "File too large", 
        error: err.message,
        code: err.code 
      });
    }
    
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        message: "Too many files or wrong field name", 
        error: err.message,
        code: err.code 
      });
    }
    
    return res.status(500).json({ 
      message: "Error uploading file", 
      error: err.message,
      code: err.code || 'UNKNOWN_ERROR' 
    });
  };

  // Simple test endpoint for file uploads
  app.post("/api/test-upload", upload.single('files'), (req, res) => {
    try {
      console.log("Received test file upload");
      if (!req.file) {
        return res.status(400).json({ message: "No file provided" });
      }
      
      console.log("Test file received:", req.file.originalname, req.file.mimetype, req.file.size, "bytes");
      
      // Clean up the file
      fs.unlinkSync(req.file.path);
      
      return res.status(200).json({ 
        message: "Test upload successful",
        fileInfo: {
          name: req.file.originalname,
          type: req.file.mimetype,
          size: req.file.size
        }
      });
    } catch (error) {
      console.error("Error in test upload:", error);
      return res.status(500).json({ message: "Error in test upload" });
    }
  });

  // Upload multiple attachments to a card
  app.post("/api/cards/:cardId/attachments", (req, res, next) => {
    console.log("Received file upload request for card:", req.params.cardId);
    console.log("Request content type:", req.headers['content-type']);
    console.log("Request field names:", Object.keys(req.body || {}).join(', '));
    
    // Increase the file limit to 20
    upload.array('files', 20)(req, res, (err) => {
      if (err) {
        console.error("Multer upload error:", err);
        return handleMulterErrors(err, req, res, next);
      }
      
      next();
    });
  }, async (req, res) => {
    try {
      console.log("Upload middleware passed, processing files...");
      const cardId = parseInt(req.params.cardId);
      const files = req.files as Express.Multer.File[];
      
      console.log("Files received:", files ? files.length : 0, "files");
      if (files && files.length > 0) {
        console.log("File names:", files.map(f => f.originalname).join(", "));
      }
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files provided" });
      }
      
      // Get card to verify it exists
      const card = await storage.getCardById(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      const attachments = [];
      
      // Process each file
      console.log("Processing files on server, count:", files.length);
      
      for (const file of files) {
        console.log("Processing file:", file.originalname, file.mimetype);
        
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
        
        attachments.push(attachment);
      }
      
      return res.status(201).json(attachments);
    } catch (error) {
      console.error("Error uploading attachments:", error);
      return res.status(500).json({ message: "Error uploading attachments" });
    }
  });
  
  // Get attachment by ID
  app.get("/api/attachments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Fetching attachment with ID: ${id}`);
      
      // Use 0 as a placeholder for cardId since we're fetching by attachment ID
      const attachments = await storage.getAttachmentsByCardId(0, id);
      
      if (!attachments || attachments.length === 0) {
        console.error(`Attachment not found with ID: ${id}`);
        return res.status(404).json({ message: "Attachment not found" });
      }
      
      const attachment = attachments[0];
      console.log(`Attachment found:`, { 
        id: attachment.id,
        filename: attachment.filename,
        fileType: attachment.fileType,
        contentLength: attachment.content ? attachment.content.length : 0
      });
      
      // Serve file contents for direct viewing (images) or download (other files)
      try {
        // Verify base64 content is valid before trying to decode
        if (!attachment.content) {
          console.error(`Empty content for attachment ID: ${id}`);
          return res.status(500).json({ message: "Attachment has no content" });
        }
        
        // Decode base64 content
        let fileBuffer = Buffer.from(attachment.content, 'base64');
        
        // Check if this is an image file
        const isImage = attachment.fileType.startsWith('image/');
        
        // Special handling for CSV files
        const isCSV = attachment.fileType.includes('csv') || attachment.filename.endsWith('.csv');
        
        // Set Content-Type based on file type
        if (isCSV) {
          // For CSV files, ensure we use UTF-8 encoding explicitly
          res.set('Content-Type', 'text/csv; charset=utf-8');
          
          // Add BOM (Byte Order Mark) for Excel compatibility
          // This helps Excel recognize the file as UTF-8
          const bom = Buffer.from('\uFEFF', 'utf8');
          fileBuffer = Buffer.concat([bom, fileBuffer]);
          
          // These headers help with CSV download issues
          res.set('X-Content-Type-Options', 'nosniff');
          res.set('Pragma', 'public');
          console.log(`Serving CSV with UTF-8 encoding and BOM for Excel compatibility`);
        } else {
          // For all other files, use original content type
          res.set('Content-Type', attachment.fileType);
        }
        
        // Set Content-Disposition header based on file type
        if (isImage) {
          // For images, use "inline" to display directly in the browser
          res.set('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.filename)}"`);
          console.log(`Setting Content-Disposition to inline for image display`);
        } else {
          // For non-image files, force download
          res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
        }
        
        // Set Content-Length header
        res.set('Content-Length', fileBuffer.length.toString());
        
        // Different cache settings based on file type
        if (isImage) {
          // Cache images for 24 hours
          res.set('Cache-Control', 'public, max-age=86400');
          console.log(`Serving image attachment: ${attachment.fileType}, size: ${fileBuffer.length} bytes, for direct display`);
        } else {
          // Don't cache non-image files
          res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
          console.log(`Serving ${attachment.fileType} attachment as download, size: ${fileBuffer.length} bytes`);
        }
        
        return res.send(fileBuffer);
      } catch (decodeError) {
        console.error(`Error decoding content for attachment ID: ${id}`, decodeError);
        return res.status(500).json({ message: "Error decoding attachment content" });
      }
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
    console.log(`[IMAGE-HANDLING] Image generation endpoint called but functionality is disabled for reimplementation`);
    return res.status(501).json({
      message: "Image generation is temporarily unavailable as we're improving this feature."
    });
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

  // TEMPORARY TEST ROUTE FOR PROMPT ASSISTANT (CHUNK 1)
  app.post("/api/test-prompt-suggestion", async (req, res) => {
    try {
      console.log("==========================================");
      console.log("Testing Prompt Assistant suggestion function");
      console.log("------------------------------------------");
      
      // Add direct logging to console
      console.log("Request body:", JSON.stringify(req.body).substring(0, 200) + "...");
      
      // Extract request data
      const { 
        sourceColumnInstructions, 
        cardTitle,
        cardDescription,
        chats,
        apiKey 
      } = req.body;
      
      // Basic validation
      if (!sourceColumnInstructions || !cardTitle || !Array.isArray(chats)) {
        console.log("Validation failed - Missing required fields");
        console.log("==========================================");
        return res.status(400).json({ 
          message: "Missing required fields", 
          required: ["sourceColumnInstructions", "cardTitle", "chats (array)"] 
        });
      }
      
      console.log(`Inputs validated. Calling getPromptSuggestion with: 
        - Source Instructions: ${sourceColumnInstructions?.substring(0, 50)}...
        - Card Title: ${cardTitle}
        - Chat Count: ${chats?.length || 0}
        - Has API Key: ${!!apiKey}`);
      
      // Call the getPromptSuggestion function with request data
      const suggestion = await getPromptSuggestion(
        sourceColumnInstructions,
        {
          title: cardTitle,
          description: cardDescription || null,
          attachments: req.body.attachments || []
        },
        chats,
        apiKey
      );
      
      console.log("Function returned successfully. Suggestion:", suggestion);
      console.log("==========================================");
      
      // Return the result with explicit Content-Type header
      res.setHeader('Content-Type', 'application/json');
      return res.json({
        tested: true,
        result: suggestion,
        inputReceived: {
          sourceColumnInstructions,
          cardTitle,
          cardDescription,
          chatCount: chats?.length || 0,
          hasApiKey: !!apiKey
        }
      });
    } catch (error) {
      console.error("Error testing prompt suggestion:", error);
      console.log("==========================================");
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({
        message: "Error testing prompt suggestion",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Prompt Analyzer Template API Routes
  app.get("/api/prompt-analyzer/template", async (req, res) => {
    try {
      // Import using ES modules syntax
      const { getTemplate } = await import('./promptAnalyzerTemplate');
      const template = getTemplate();
      res.json({ template });
    } catch (error) {
      console.error("Error fetching prompt analyzer template:", error);
      res.status(500).json({ message: "Error fetching template", error: String(error) });
    }
  });

  app.post("/api/prompt-analyzer/template", async (req, res) => {
    try {
      // Import using ES modules syntax
      const { saveTemplate } = await import('./promptAnalyzerTemplate');
      const template = req.body;
      
      // Basic validation
      if (!template || !template.context || !template.analysisGuidelines || 
          !template.columnSpecificGuidance || !template.responseFormat) {
        return res.status(400).json({ message: "Invalid template format" });
      }
      
      const success = saveTemplate(template);
      
      if (success) {
        res.json({ message: "Template saved successfully" });
      } else {
        res.status(500).json({ message: "Failed to save template" });
      }
    } catch (error) {
      console.error("Error saving prompt analyzer template:", error);
      res.status(500).json({ message: "Error saving template", error: String(error) });
    }
  });

  // Register Zapier MCP routes
  registerMcpRoutes(app);
  registerWorkflowRoutes(app);
  
  const httpServer = createServer(app);
  
  // Set up WebSocket server for real-time typing indicators
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws'
  });
  
  // Store active connections by card ID
  const connections: Map<number, Set<WebSocket>> = new Map();

  // Log WebSocket server status
  console.log('WebSocket server initialized at path: /ws');

  wss.on('connection', (ws) => {
    console.log('✅ WebSocket client connected');
    let subscribedCardId: number | null = null;
    
    ws.on('message', (message) => {
      try {
        console.log('📩 WebSocket message received:', message.toString());
        const data = JSON.parse(message.toString());
        
        // Handle subscription to a specific card
        if (data.type === 'subscribe' && data.cardId) {
          const cardId = parseInt(data.cardId);
          subscribedCardId = cardId;
          
          // Add this connection to the card's subscribers
          if (!connections.has(cardId)) {
            connections.set(cardId, new Set());
          }
          connections.get(cardId)?.add(ws);
          console.log(`✅ Client subscribed to card ${cardId}`);
          
          // Send a confirmation message back
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'subscribed',
              cardId: cardId,
              message: 'Successfully subscribed to card updates'
            }));
          }
        }
        
        // Handle AI typing indicator updates
        if (data.type === 'typing' && data.cardId) {
          const cardId = parseInt(data.cardId);
          console.log(`📢 Broadcasting typing status for card ${cardId}:`, data);
          broadcastToCard(cardId, {
            type: 'typing',
            cardId: cardId,
            gptName: data.gptName || 'AI Assistant',
            gptColor: data.gptColor || null,
            isTyping: data.isTyping || true
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      // Remove this connection from the card's subscribers
      if (subscribedCardId && connections.has(subscribedCardId)) {
        connections.get(subscribedCardId)?.delete(ws);
        // Clean up empty sets
        if (connections.get(subscribedCardId)?.size === 0) {
          connections.delete(subscribedCardId);
        }
      }
    });
  });
  
  // Broadcast AI typing status to all clients subscribed to a card
  function broadcastToCard(cardId: number, data: any) {
    if (!connections.has(cardId)) {
      console.log(`ℹ️ No active connections for card ${cardId}`);
      return;
    }
    
    const cardConnections = connections.get(cardId);
    if (!cardConnections || cardConnections.size === 0) {
      console.log(`ℹ️ No clients subscribed to card ${cardId}`);
      return;
    }
    
    console.log(`📣 Broadcasting to ${cardConnections.size} clients for card ${cardId}`);
    
    const message = JSON.stringify(data);
    let sentCount = 0;
    
    cardConnections.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
          sentCount++;
        } catch (error) {
          console.error(`❌ Error sending message to client:`, error);
        }
      } else {
        console.log(`⚠️ Client connection not open, state: ${client.readyState}`);
      }
    });
    
    console.log(`✅ Message sent to ${sentCount}/${cardConnections.size} clients`);
  }
  
  // Function to notify clients about AI typing status
  async function notifyTypingStatus(cardId: number, gptName: string, gptColor: string | null, isTyping: boolean) {
    broadcastToCard(cardId, {
      type: 'typing',
      cardId,
      gptName,
      gptColor,
      isTyping
    });
  }
  
  // Create wrapped versions of the OpenAI functions that add WebSocket typing indicators
  // Create function to wrap process chat with typing indicators
  const wrapProcessChatWithTypingIndicator = async (cardId: number, userMessage: string, column: any) => {
    try {
      // Start typing indicator
      await notifyTypingStatus(cardId, column.gptName || 'AI Assistant', column.gptColor, true);
      
      // Process the actual request
      const result = await processChat(cardId, userMessage, column);
      
      // Stop typing indicator
      await notifyTypingStatus(cardId, column.gptName || 'AI Assistant', column.gptColor, false);
      
      return result;
    } catch (error) {
      // Ensure typing indicator is removed on error
      await notifyTypingStatus(cardId, column.gptName || 'AI Assistant', column.gptColor, false);
      throw error;
    }
  };
  
  // Create function to wrap trigger GPT with typing indicators
  const wrapTriggerGPTWithTypingIndicator = async (cardId: number, column: any) => {
    try {
      // Start typing indicator
      await notifyTypingStatus(cardId, column.gptName || 'AI Assistant', column.gptColor, true);
      
      // Process the actual request
      const result = await triggerGPTProcessing(cardId, column);
      
      // Stop typing indicator
      await notifyTypingStatus(cardId, column.gptName || 'AI Assistant', column.gptColor, false);
      
      return result;
    } catch (error) {
      // Ensure typing indicator is removed on error
      await notifyTypingStatus(cardId, column.gptName || 'AI Assistant', column.gptColor, false);
      throw error;
    }
  };
  
  // Register API routes to use our wrapped versions of the functions
  app.post("/api/cards/:id/chat", async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }
      
      const card = await storage.getCardById(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Get the column
      const column = await storage.getColumnById(card.columnId);
      if (!column) {
        return res.status(404).json({ message: "Column not found" });
      }
      
      // Use our wrapped version with typing indicators
      await wrapProcessChatWithTypingIndicator(cardId, message, column);
      
      return res.json({ message: "Chat processed" });
    } catch (error) {
      console.error("Error processing chat:", error);
      return res.status(500).json({ message: "Error processing chat" });
    }
  });
  
  app.post("/api/cards/:id/trigger-gpt", async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      
      const card = await storage.getCardById(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Get the column
      const column = await storage.getColumnById(card.columnId);
      if (!column) {
        return res.status(404).json({ message: "Column not found" });
      }
      
      // Use our wrapped version
      await wrapTriggerGPTWithTypingIndicator(cardId, column);
      
      return res.json({ message: "GPT processing triggered" });
    } catch (error) {
      console.error("Error triggering GPT:", error);
      return res.status(500).json({ message: "Error triggering GPT" });
    }
  });

  return httpServer;
}
