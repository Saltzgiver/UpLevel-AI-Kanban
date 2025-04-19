# Zapier MCP Integration

This document provides an overview of the Zapier MCP (Multi-Channel Publishing) integration for the UpLevel Kanban Board.

## Overview

The MCP integration allows you to automatically publish cards to external platforms like LinkedIn, Twitter, Slack, and more when they're moved to specific columns in your Kanban board.

## Setup

1. **Environment Configuration**:
   - Add your Zapier MCP credentials to your environment variables:
     ```
     MCP_ENABLED=true
     ZAPIER_MCP_ENDPOINT=https://api.zapier.com/v1/mcp
     ZAPIER_MCP_KEY=your_mcp_key_here
     APP_URL=https://your-app-url.replit.app
     ```

2. **Database Migration**:
   - Run the MCP database migration script to create the necessary tables:
     ```
     node migrate_mcp_tables.js
     ```

3. **Generate Sample Actions**:
   - Populate the database with sample MCP actions:
     ```
     node generate_mcp_actions.js
     ```

## Usage

### Enabling MCP for a Column

1. Create or edit a column in your Kanban board
2. Use the column settings to enable MCP
3. Configure the MCP actions for the column

API example:
```javascript
// Enable MCP for a column
fetch('/api/columns/123/mcp-settings', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mcpEnabled: true,
    mcpAutoTrigger: true
  })
});

// Add an MCP action to a column
fetch('/api/columns/123/mcp-actions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    actionName: 'linkedin_post'
  })
});
```

### Automatic Publishing

When MCP is enabled for a column, cards moved to that column will be automatically published to the configured external platforms.

### Manual Publishing

You can also manually trigger publishing for a specific card:

```javascript
fetch('/api/cards/456/mcp-publish', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    actionName: 'linkedin_post'
  })
});
```

## API Endpoints

### MCP Settings

- `PATCH /api/columns/:id/mcp-settings` - Update MCP settings for a column
- `GET /api/mcp/actions` - Get all available MCP actions
- `GET /api/columns/:columnId/mcp-actions` - Get MCP actions for a specific column
- `POST /api/columns/:columnId/mcp-actions` - Add an MCP action to a column
- `DELETE /api/columns/:columnId/mcp-actions/:actionId` - Remove an MCP action from a column
- `POST /api/cards/:cardId/mcp-publish` - Manually publish a card with a specific MCP action
- `GET /api/mcp/ping` - Test connection to Zapier MCP
- `GET /api/mcp/logs` - Get MCP logs

## Testing

To test the MCP integration, run:

```
node test-mcp-integration.js
```

This will create a test column with MCP enabled, create a test card, and attempt to publish it.

## Troubleshooting

1. **MCP integration is disabled**
   - Check that `MCP_ENABLED=true` is set in your environment variables

2. **Connection errors**
   - Verify your Zapier MCP endpoint and API key
   - Use the `/api/mcp/ping` endpoint to test the connection

3. **Publishing errors**
   - Check the MCP logs for detailed error information
   - Ensure the card has all required fields for the chosen action

4. **Port conflicts**
   - If the default port (5000) is in use, set `PORT=3000` in your environment variables
   - Or use the `node start-on-port-3000.js` script to start the application