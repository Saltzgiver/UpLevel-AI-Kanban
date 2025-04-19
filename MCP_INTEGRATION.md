# Zapier MCP Integration - Technical Documentation

## Overview

This document provides technical details about the implementation of Zapier Multi-Channel Publishing (MCP) integration in the UpLevel Kanban board application.

## Components

### 1. Database Schema

The MCP integration uses the following tables:

- `mcp_actions`: Stores the available publishing actions (LinkedIn, Twitter, etc.)
- `column_mcp_actions`: Maps columns to the publishing actions they support
- `mcp_logs`: Logs all publishing activities and responses
- Added fields to `columns` table:
  - `mcp_enabled`: Whether MCP is enabled for the column
  - `mcp_auto_trigger`: Whether publishing happens automatically when cards move to the column
- Added fields to `cards` table:
  - `external_id`: ID of the published post/content on the external platform
  - `external_url`: URL to the published post/content
  - `source`: Source of the card (manual, zapier, etc.)

### 2. API Client

The `mcpClient.ts` file implements the API client for communicating with Zapier:

- `McpClient` class: Handles authentication and API requests
- `runMcpAction`: Executes a publishing action for a card
- `validateMcpSignature`: Validates incoming webhook signatures
- `logMcpRequest`: Logs all API requests and responses

Key features:
- Works without requiring an API key (webhook-only mode)
- Supports HMAC signature validation for secure webhooks
- Detailed logging of all requests and responses

### 3. API Routes

The `/server/routes/mcp.ts` file implements the following API endpoints:

- `POST /api/mcp/hooks`: Receives inbound webhooks from Zapier
- `GET /api/mcp/actions`: Lists all available publishing actions
- `GET /api/columns/:columnId/mcp-actions`: Lists actions for a specific column
- `POST /api/columns/:columnId/mcp-actions`: Adds an action to a column
- `DELETE /api/columns/:columnId/mcp-actions/:actionId`: Removes an action from a column
- `POST /api/cards/:cardId/mcp-publish`: Manually triggers publishing for a card
- `GET /api/mcp/logs`: Lists all publishing logs
- `GET /api/mcp/logs/:id`: Gets details for a specific log entry
- `PATCH /api/columns/:id/mcp-settings`: Updates MCP settings for a column

### 4. Card Movement Integration

The integration with card movement is implemented in the `storage.ts` file:

- Enhanced `moveCard` method to check if destination column has MCP enabled
- If enabled and auto-trigger is on, triggers publishing actions for the card
- Updates card with external ID and URL when publishing succeeds

### 5. Configuration

The MCP integration is configurable via environment variables:

- `MCP_ENABLED`: Set to 'true' to enable the MCP integration
- `ZAPIER_MCP_ENDPOINT`: The URL of the Zapier webhook endpoint
- `ZAPIER_MCP_KEY`: Optional API key for validating webhook signatures

## Data Flow

### Publishing Flow

1. User moves a card to an MCP-enabled column or manually triggers publishing
2. System checks if the column has any associated MCP actions
3. For each action, the system calls the Zapier webhook with the card data
4. Zapier processes the request and publishes to the configured platform
5. Zapier responds with success/failure and external ID/URL
6. System updates the card with the external ID/URL and logs the result

### Inbound Webhook Flow

1. Zapier sends data to the `/api/mcp/hooks` endpoint
2. System validates the webhook signature (if API key is configured)
3. System creates a new card in the default inbox column
4. Card is created with source="zapier" and any external ID provided
5. System logs the inbound webhook and its processing

## Testing

The MCP integration can be tested with:

- `test-mcp-basic.js`: Tests the basic MCP functionality
- `test-mcp-integration.js`: Tests the full MCP integration flow

## Error Handling

The MCP integration includes comprehensive error handling:

- All API errors are logged in the MCP logs table
- Timeouts and connection issues are handled gracefully
- Validation errors for malformed requests are clearly reported
- Duplicate events are detected and handled appropriately

## Security Considerations

- Webhook signatures can be validated with HMAC-SHA256
- All sensitive data is stored securely
- Rate limiting is implemented to prevent abuse
- Error messages are sanitized to prevent information leakage