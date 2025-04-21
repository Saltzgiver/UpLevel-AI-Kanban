# Zapier MCP Integration Guide

This guide explains how to use the Multi-Channel Publishing (MCP) integration with Zapier in the UpLevel Kanban board application.

## Overview

The Zapier MCP integration allows you to automatically publish your card content to various channels when cards are moved to specific columns. For example, you can set up a column called "Ready to Publish" and automatically send the card content to Twitter, LinkedIn, or other platforms when cards are moved there.

## Key Features

- **Column-based publishing**: Configure specific columns to trigger publishing actions
- **Multiple publishing destinations**: Support for various platforms through Zapier
- **Automatic or manual publishing**: Configure columns to publish automatically or manually
- **Publishing logs**: Track all publishing activities with detailed logs
- **External IDs and URLs**: Cards track their published status with external IDs and URLs

## Setup Instructions

### 1. Enable MCP Integration

The MCP integration is enabled by default. It requires:

- `MCP_ENABLED=true` in your `.env` file
- `ZAPIER_MCP_ENDPOINT` set to your Zapier webhook URL

### 2. Configure a Column for Publishing

1. Go to your board and identify the column you want to enable for publishing
2. Open the column settings
3. Enable the MCP toggle
4. Save your changes

### 3. Add Publishing Actions to the Column

1. Go to the column settings
2. Select the "Publishing Actions" tab
3. Add the publishing actions you want to enable for this column (e.g., "Post to LinkedIn", "Tweet on X")
4. Save your changes

### 4. Test the Integration

1. Create a new card or move an existing card to your MCP-enabled column
2. If auto-publishing is enabled, the card will be automatically published
3. If manual publishing is enabled, click the "Publish" button on the card
4. Check the card's activity log to see the publishing status

## Publishing Actions

The following publishing actions are available:

- **Post to LinkedIn**: Publish the card as a post on LinkedIn
- **Tweet on X**: Post the card as a tweet on X/Twitter
- **Send to Slack**: Send the card as a message to a Slack channel
- **Publish to WordPress**: Create a new WordPress post from the card
- **Create Notion Page**: Create a new Notion page from the card
- **Send Email**: Send an email notification about the card
- **Ping (Test Connection)**: Test the connection to the Zapier MCP integration

## Technical Details

### Webhook Format

When a card is published, the following data is sent to your Zapier webhook:

```json
{
  "title": "Card Title",
  "body": "Card Description",
  "column": "Column Name",
  "column_id": 123,
  "board_id": 456,
  "url": "/card/789",
  "attachments": [
    {
      "filename": "document.pdf",
      "content": "base64-encoded-content-or-url"
    }
  ]
}
```

### Response Format

The Zapier MCP integration should respond with a JSON object containing:

```json
{
  "success": true,
  "external_id": "12345",
  "external_url": "https://example.com/post/12345"
}
```

If an error occurs, the response should contain:

```json
{
  "success": false,
  "message": "Error message"
}
```

## Troubleshooting

### Common Issues

1. **405 Method Not Allowed**: Verify your Zapier webhook URL is correct and active. Note that Zapier MCP expects GET requests with query parameters, not POST requests with JSON payload.
2. **Connection Timeout**: Check your network settings and Zapier account status
3. **Authentication Failed**: Ensure your `ZAPIER_MCP_KEY` is correct (if using)

### Important Implementation Note

The Zapier MCP integration uses HTTP GET requests with query parameters rather than POST requests with JSON payload. This is different from many other API integrations. When setting up your Zapier webhooks, ensure they are configured to accept GET requests with parameters in the query string.

### Viewing Logs

To troubleshoot publishing issues:

1. Go to the Admin settings
2. Select the "MCP Logs" tab
3. Review the logs for detailed error information

## Need Help?

If you encounter any issues with the MCP integration, contact support at support@uplevel.com.