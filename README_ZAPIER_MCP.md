# Integrating Zapier MCP with UpLevel Kanban Board

This guide explains how to integrate UpLevel Kanban Board with Zapier's MCP (Multi-Channel Publishing) API to enable automatic content publishing from your cards.

## What is Zapier MCP?

Zapier's MCP (Multi-Channel Publishing) API enables automatic content distribution across multiple platforms. When a card is moved to a designated "publishing" column, UpLevel Kanban can use Zapier MCP to publish that content to platforms like:

- LinkedIn
- Twitter/X
- WordPress
- Slack
- Notion
- Email systems
- And many more...

## Architecture

The integration is implemented with these key components:

1. **Database Schema**:
   - `mcpActions` table for storing available publishing actions
   - `columnMcpActions` table mapping columns to actions
   - `mcpLogs` table for tracking API requests
   - Additional fields in `columns` and `cards` tables

2. **Client**:
   - `mcpClient.ts` for communicating with Zapier MCP API
   - HMAC signature generation for authentication

3. **Workflow**:
   - Automatic triggering when cards move to MCP-enabled columns
   - Manual triggering through API endpoints
   - Detailed logging and error handling

## Setup Instructions

### 1. Configure Environment Variables

Create a `.env` file with your Zapier MCP credentials:

```
MCP_ENABLED=true
ZAPIER_MCP_ENDPOINT=https://api.zapier.com/v1/mcp
ZAPIER_MCP_KEY=your_secret_key_here
APP_URL=https://your-app-url.replit.app
```

### 2. Run Database Migrations

Run the migration script to create the necessary database tables:

```bash
node migrate_mcp_tables.js
```

### 3. Create Sample Actions

Populate the database with sample MCP actions:

```bash
node generate_mcp_actions.js
```

### 4. Start the Application

Start the application using:

```bash
node start-on-port-3000.js
```

## Using the Integration

### Enabling MCP for a Column

1. Create or select a column to be used for publishing
2. Enable MCP for the column:
   ```bash
   curl -X PATCH http://localhost:3000/api/columns/1/mcp-settings \
     -H "Content-Type: application/json" \
     -d '{"mcpEnabled": true, "mcpAutoTrigger": true}'
   ```

3. Associate MCP actions with the column:
   ```bash
   curl -X POST http://localhost:3000/api/columns/1/mcp-actions \
     -H "Content-Type: application/json" \
     -d '{"actionName": "linkedin_post"}'
   ```

### Automatic Publishing

Once MCP is enabled for a column, any card moved to that column will be automatically published using the configured actions.

### Manual Publishing

You can also manually trigger publishing for a specific card:

```bash
curl -X POST http://localhost:3000/api/cards/123/mcp-publish \
  -H "Content-Type: application/json" \
  -d '{"actionName": "twitter_tweet"}'
```

### Viewing Logs

View MCP activity logs:

```bash
curl http://localhost:3000/api/mcp/logs
```

## Testing

To test the MCP integration:

```bash
node test-mcp-integration.js
```

## Troubleshooting

### Connection Issues

If you're having trouble connecting to the Zapier MCP API:

```bash
curl http://localhost:3000/api/mcp/ping
```

This will test the connection and report any issues.

### Port Conflicts

If port 5000 is already in use, you can modify the PORT in your .env file:

```
PORT=3000
```

Or use the provided script:

```bash
node start-on-port-3000.js
```

## API Reference

The following API endpoints are available for the MCP integration:

- `GET /api/mcp/actions` - List all available MCP actions
- `GET /api/columns/:columnId/mcp-actions` - Get actions for a column
- `POST /api/columns/:columnId/mcp-actions` - Add action to column
- `DELETE /api/columns/:columnId/mcp-actions/:actionId` - Remove action
- `PATCH /api/columns/:id/mcp-settings` - Update MCP settings
- `POST /api/cards/:cardId/mcp-publish` - Manually publish a card
- `GET /api/mcp/ping` - Test API connection
- `GET /api/mcp/logs` - View logs

For more detailed documentation, see `MCP_INTEGRATION.md`.