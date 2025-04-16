# Starting the AI Kanban Board Application

## Quick Start

When the "Run" button in Replit doesn't work properly, you can use one of these methods to start the application:

### Method 1: Use the Start Script (Recommended)

Open a Shell in Replit and run:

```bash
./start.sh
```

This script will:
1. Check if any process is already using port 5000
2. Kill any existing process if necessary
3. Start the application with `npm run dev`

### Method 2: Use the Fix-Startup Script

Alternatively, you can run:

```bash
node fix-startup.js
```

This does the same thing but using Node.js instead of shell commands.

### Method 3: Use the Workflow

Click on the "Start application" workflow in the dropdown menu under the Run button.

## Troubleshooting

If you still have issues:

1. Check the console for error messages
2. Make sure no other process is using port 5000
3. Verify that the database connection is working properly
4. Restart your Replit if necessary

## Port Information

The application runs on port 5000, which is configured in `server/index.ts`.