/**
 * Zapier MCP Integration Routes
 * 
 * This module defines the API routes for interacting with Zapier MCP:
 * - Inbound webhook for receiving Zapier events
 * - Endpoints for managing MCP actions and configurations
 * - Testing and validation endpoints
 */

import { Express, Request, Response } from 'express';
import { fromZodError } from 'zod-validation-error';
import { ZodError } from 'zod';
import { log } from '../vite';
import { db } from '../db';
import { storage } from '../storage';
import { 
  mcpActions, 
  columnMcpActions, 
  mcpLogs, 
  insertMcpActionSchema, 
  insertColumnMcpActionSchema,
  cards,
  insertCardSchema
} from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { validateMcpSignature, logMcpRequest, runMcpAction } from '../mcpClient';
// Environment variables are already loaded by the main application

// Feature flag to enable/disable MCP integration
const MCP_ENABLED = process.env.MCP_ENABLED === 'true';

/**
 * Register all MCP-related routes
 */
export function registerMcpRoutes(app: Express) {
  if (!MCP_ENABLED) {
    log('MCP integration is disabled. MCP routes will not be registered.');
    return;
  }
  
  log('Registering MCP routes');
  
  // Inbound webhook for receiving Zapier events
  app.post('/api/mcp/hooks', async (req, res) => {
    try {
      const startTime = Date.now();
      log('Received inbound MCP webhook');
      
      // Only validate signature if API key is provided
      const signature = req.headers['x-mcp-signature'] as string;
      const apiKey = process.env.ZAPIER_MCP_KEY || '';
      
      if (apiKey && apiKey !== 'no-key-required' && signature && 
          !validateMcpSignature(signature, JSON.stringify(req.body), apiKey)) {
        log('Invalid MCP signature');
        
        // Log the failed request
        await logMcpRequest(
          'inbound',
          '/api/mcp/hooks',
          null,
          JSON.stringify(req.body),
          JSON.stringify({ error: 'Invalid signature' }),
          401,
          Date.now() - startTime,
          'Invalid signature'
        );
        
        return res.status(401).json({ error: 'Invalid signature' });
      }
      
      // Parse the payload
      const { event } = req.body;
      
      if (!event) {
        log('Invalid MCP webhook payload: missing event');
        
        // Log the invalid request
        await logMcpRequest(
          'inbound',
          '/api/mcp/hooks',
          null,
          JSON.stringify(req.body),
          JSON.stringify({ error: 'Invalid payload: missing event' }),
          400,
          Date.now() - startTime,
          'Invalid payload'
        );
        
        return res.status(400).json({ error: 'Invalid payload: missing event' });
      }
      
      // Check for duplicate events (idempotency)
      if (event.id) {
        const existingCards = await db.select({ id: cards.id })
          .from(cards)
          .where(eq(cards.externalId, event.id.toString()));
        
        if (existingCards.length > 0) {
          log(`Duplicate event detected: ${event.id}`);
          
          // Log the duplicate event
          await logMcpRequest(
            'inbound',
            '/api/mcp/hooks',
            event.id.toString(),
            JSON.stringify(req.body),
            JSON.stringify({ message: 'Duplicate event, already processed', cardId: existingCards[0].id }),
            200,
            Date.now() - startTime,
            null
          );
          
          return res.status(200).json({ 
            received: true, 
            cardId: existingCards[0].id,
            message: 'Duplicate event, already processed'
          });
        }
      }
      
      // Map the event data to a card
      const title = event.data?.title || event.action || 'Zapier Event';
      const description = event.data?.body || JSON.stringify(event.data || {});
      
      // Find the default inbox column
      const boards = await storage.getBoards();
      if (boards.length === 0 || boards[0].columns.length === 0) {
        log('No board or columns found for creating card from MCP webhook');
        
        // Log the failed request
        await logMcpRequest(
          'inbound',
          '/api/mcp/hooks',
          event.id?.toString() || null,
          JSON.stringify(req.body),
          JSON.stringify({ error: 'No board or columns found' }),
          500,
          Date.now() - startTime,
          'No board or columns found'
        );
        
        return res.status(500).json({ error: 'No board or columns found' });
      }
      
      // Use the first column of the first board as inbox
      const inboxColumnId = boards[0].columns[0].id;
      
      // Create the card
      const cardData = insertCardSchema.parse({
        title,
        description,
        columnId: inboxColumnId,
        order: 0, // Will be updated by the storage layer
        externalId: event.id?.toString() || null,
        source: 'zapier'
      });
      
      const card = await storage.createCard(cardData);
      log(`Created card from MCP webhook: ${card.id}`);
      
      // Process any files if they exist
      if (event.files && Array.isArray(event.files) && event.files.length > 0) {
        log(`Processing ${event.files.length} files from MCP webhook`);
        
        for (const file of event.files) {
          try {
            // In a real implementation, we would download the file from the URL,
            // upload it to S3, and create an attachment record
            log(`Would process file: ${file.url}`);
            
            // For now, we'll just create a placeholder attachment record
            // with the file URL in the content field
            await storage.createAttachment({
              cardId: card.id,
              filename: file.name || 'file.txt',
              fileType: file.type || 'text/plain',
              content: file.url || ''
            });
          } catch (fileError) {
            log(`Error processing file from MCP webhook: ${fileError}`);
          }
        }
      }
      
      // Log the successful request
      await logMcpRequest(
        'inbound',
        '/api/mcp/hooks',
        event.id?.toString() || null,
        JSON.stringify(req.body),
        JSON.stringify({ received: true, cardId: card.id }),
        200,
        Date.now() - startTime,
        null,
        card.id
      );
      
      return res.status(200).json({ received: true, cardId: card.id });
    } catch (error) {
      log(`Error processing MCP webhook: ${error}`);
      
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: fromZodError(error).details 
        });
      }
      
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // Get all MCP actions
  app.get('/api/mcp/actions', async (req, res) => {
    try {
      const actions = await db.select().from(mcpActions).where(eq(mcpActions.enabled, true));
      return res.json(actions);
    } catch (error) {
      log(`Error fetching MCP actions: ${error}`);
      return res.status(500).json({ error: 'Error fetching MCP actions' });
    }
  });
  
  // Get MCP actions for a specific column
  app.get('/api/columns/:columnId/mcp-actions', async (req, res) => {
    try {
      const columnId = parseInt(req.params.columnId);
      
      const actions = await db.select({
        id: columnMcpActions.id,
        columnId: columnMcpActions.columnId,
        actionName: columnMcpActions.actionName,
        enabled: columnMcpActions.enabled,
        createdAt: columnMcpActions.createdAt,
        // Join with actions table to get display name and description
        displayName: mcpActions.displayName,
        description: mcpActions.description
      })
      .from(columnMcpActions)
      .leftJoin(mcpActions, eq(columnMcpActions.actionName, mcpActions.name))
      .where(and(
        eq(columnMcpActions.columnId, columnId),
        eq(columnMcpActions.enabled, true)
      ));
      
      return res.json(actions);
    } catch (error) {
      log(`Error fetching MCP actions for column: ${error}`);
      return res.status(500).json({ error: 'Error fetching MCP actions for column' });
    }
  });
  
  // Add an MCP action to a column
  app.post('/api/columns/:columnId/mcp-actions', async (req, res) => {
    try {
      const columnId = parseInt(req.params.columnId);
      const { actionName } = req.body;
      
      if (!actionName) {
        return res.status(400).json({ error: 'Action name is required' });
      }
      
      // Check if the column exists
      const column = await storage.getColumnById(columnId);
      if (!column) {
        return res.status(404).json({ error: 'Column not found' });
      }
      
      // Check if the action exists
      const actions = await db.select().from(mcpActions).where(eq(mcpActions.name, actionName));
      if (actions.length === 0) {
        return res.status(404).json({ error: 'Action not found' });
      }
      
      // Check if the action is already associated with the column
      const existingActions = await db.select()
        .from(columnMcpActions)
        .where(and(
          eq(columnMcpActions.columnId, columnId),
          eq(columnMcpActions.actionName, actionName)
        ));
      
      if (existingActions.length > 0) {
        // If it exists but is disabled, enable it
        if (!existingActions[0].enabled) {
          await db.update(columnMcpActions)
            .set({ enabled: true })
            .where(eq(columnMcpActions.id, existingActions[0].id));
          
          return res.status(200).json({ message: 'Action enabled for column' });
        }
        
        return res.status(409).json({ error: 'Action already associated with column' });
      }
      
      // Create the association
      const data = insertColumnMcpActionSchema.parse({
        columnId,
        actionName,
        enabled: true
      });
      
      const result = await db.insert(columnMcpActions).values(data).returning();
      
      return res.status(201).json(result[0]);
    } catch (error) {
      log(`Error adding MCP action to column: ${error}`);
      
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: fromZodError(error).details 
        });
      }
      
      return res.status(500).json({ error: 'Error adding MCP action to column' });
    }
  });
  
  // Remove an MCP action from a column
  app.delete('/api/columns/:columnId/mcp-actions/:actionId', async (req, res) => {
    try {
      const columnId = parseInt(req.params.columnId);
      const actionId = parseInt(req.params.actionId);
      
      // Check if the association exists
      const existingActions = await db.select()
        .from(columnMcpActions)
        .where(and(
          eq(columnMcpActions.id, actionId),
          eq(columnMcpActions.columnId, columnId)
        ));
      
      if (existingActions.length === 0) {
        return res.status(404).json({ error: 'Action association not found' });
      }
      
      // Soft delete (disable) the association instead of removing it
      await db.update(columnMcpActions)
        .set({ enabled: false })
        .where(eq(columnMcpActions.id, actionId));
      
      return res.status(200).json({ message: 'Action removed from column' });
    } catch (error) {
      log(`Error removing MCP action from column: ${error}`);
      return res.status(500).json({ error: 'Error removing MCP action from column' });
    }
  });
  
  // Manually trigger an MCP action for a card
  app.post('/api/cards/:cardId/mcp-publish', async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId);
      const { actionName } = req.body;
      
      if (!actionName) {
        return res.status(400).json({ error: 'Action name is required' });
      }
      
      // Get the card details
      const card = await storage.getCardById(cardId);
      if (!card) {
        return res.status(404).json({ error: 'Card not found' });
      }
      
      // Get the column details
      const column = await storage.getColumnById(card.columnId);
      if (!column) {
        return res.status(404).json({ error: 'Column not found' });
      }
      
      // Prepare the card data for MCP
      const mcpData = {
        title: card.title,
        body: card.description || '',
        // Include additional metadata
        column: column.name,
        column_id: column.id,
        board_id: column.boardId,
        url: `${process.env.APP_URL || ''}/card/${cardId}`,
        // Add attachments if they exist
        attachments: card.attachments?.map(att => ({
          filename: att.filename,
          type: att.fileType,
          content: att.content || ''
        })) || []
      };
      
      // Run the MCP action
      log(`Manually triggering MCP action ${actionName} for card ${cardId}`);
      const result = await runMcpAction(
        actionName, 
        mcpData,
        cardId,
        column.id
      );
      
      // Update the card with external ID if provided in the result
      if (result?.external_id) {
        await db
          .update(cards)
          .set({ 
            externalId: result.external_id.toString(),
            externalUrl: result.external_url || null
          })
          .where(eq(cards.id, cardId));
      }
      
      return res.status(200).json({ 
        success: true,
        message: `Card published successfully with action ${actionName}`,
        result
      });
    } catch (error: any) {
      log(`Error manually triggering MCP action: ${error.message}`);
      return res.status(500).json({ 
        error: 'Error publishing card',
        message: error.message
      });
    }
  });

  // Test connection to Zapier MCP
  app.get('/api/mcp/ping', async (req, res) => {
    try {
      const startTime = Date.now();
      
      if (!process.env.ZAPIER_MCP_ENDPOINT) {
        return res.status(400).json({ error: 'MCP webhook URL is missing' });
      }
      
      // Run a simple test action
      const result = await runMcpAction('ping', { 
        message: 'Testing connection from Uplevel Kanban'
      });
      
      const duration = Date.now() - startTime;
      
      return res.status(200).json({ 
        success: true, 
        message: 'Connection successful', 
        duration,
        result
      });
    } catch (error: any) {
      log(`Error testing MCP connection: ${error}`);
      return res.status(500).json({ 
        error: 'Error testing MCP connection', 
        details: error.message || String(error)
      });
    }
  });
  
  // Get MCP logs
  app.get('/api/mcp/logs', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string || '50');
      const offset = parseInt(req.query.offset as string || '0');
      const cardId = req.query.cardId ? parseInt(req.query.cardId as string) : undefined;
      const columnId = req.query.columnId ? parseInt(req.query.columnId as string) : undefined;
      
      let query = db.select().from(mcpLogs).orderBy(mcpLogs.createdAt);
      
      if (cardId) {
        query = query.where(eq(mcpLogs.cardId, cardId));
      }
      
      if (columnId) {
        query = query.where(eq(mcpLogs.columnId, columnId));
      }
      
      const logs = await query.limit(limit).offset(offset);
      
      return res.json(logs);
    } catch (error) {
      log(`Error fetching MCP logs: ${error}`);
      return res.status(500).json({ error: 'Error fetching MCP logs' });
    }
  });
}