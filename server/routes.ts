import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { triggerGPTProcessing, processChat, generateImage, getPromptSuggestion } from "./openai";
import { insertBoardSchema, insertColumnSchema, insertCardSchema, insertChatSchema } from "@shared/schema";
import { z } from "zod";
import { ZodError } from "zod";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fromZodError } from "zod-validation-error";

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
      
      const card = await storage.moveCard(cardId, parseInt(destinationColumnId), position);
      
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Get the source column to potentially analyze for prompt suggestions
      const sourceColumn = sourceColumnId ? await storage.getColumnById(parseInt(sourceColumnId)) : null;
      
      // Check if destination column has GPT assigned and auto-trigger is enabled
      const destColumn = await storage.getColumnById(parseInt(destinationColumnId));
      
      // If the card is moved from one GPT column to another, analyze for prompt improvement suggestions
      if (sourceColumn && sourceColumn.gptAssigned && destColumn && destColumn.gptAssigned) {
        // Run this analysis asynchronously so it doesn't block the main flow
        setTimeout(async () => {
          try {
            // Get the card details for analysis
            const cardWithDetails = await storage.getCardById(cardId);
            if (!cardWithDetails) return;
            
            // Get the chats from the card while it was in the source column
            const chats = await storage.getChatsByCardId(cardId);
            if (!chats || chats.length === 0) return; // No chats to analyze
            
            // Create card context object for analysis
            const cardContext = {
              title: cardWithDetails.title,
              description: cardWithDetails.description,
              attachments: cardWithDetails.attachments || []
            };
            
            // Get prompt improvement suggestion
            const promptSuggestion = await getPromptSuggestion(
              sourceColumn.gptInstructions || "", 
              cardContext,
              chats,
              sourceColumn.apiKey || undefined
            );
            
            // Log the suggestion for now (in a future chunk, this would be shown to the user in the UI)
            if (promptSuggestion) {
              console.log(`Prompt suggestion for column ${sourceColumn.id}:`, promptSuggestion);
            }
          } catch (error) {
            console.error("Error generating prompt suggestion:", error);
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
        res.json(card);
        
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
      
      // Serve file contents for direct download (both images and other files like CSV)
      try {
        // Verify base64 content is valid before trying to decode
        if (!attachment.content) {
          console.error(`Empty content for attachment ID: ${id}`);
          return res.status(500).json({ message: "Attachment has no content" });
        }
        
        // Decode base64 content
        let fileBuffer = Buffer.from(attachment.content, 'base64');
        
        // Set proper headers for direct download
        // Special handling for CSV files
        const isCSV = attachment.fileType.includes('csv') || attachment.filename.endsWith('.csv');
        
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
          // For non-CSV files, use original content type
          res.set('Content-Type', attachment.fileType);
        }
        
        // Force download with Content-Disposition header
        res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
        res.set('Content-Length', fileBuffer.length.toString());
        
        // Different cache settings based on file type
        if (attachment.fileType.startsWith('image/')) {
          res.set('Cache-Control', 'public, max-age=86400'); // Cache images for 24 hours
          console.log(`Serving image attachment: ${attachment.fileType}, size: ${fileBuffer.length} bytes`);
        } else {
          res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate'); // Don't cache CSVs
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

  const httpServer = createServer(app);

  return httpServer;
}
