#!/bin/bash

# Run on Port 3000 - Launcher Script
# This script is used by the workflow to start the application on port 3000
# instead of the conflicting port 5000

echo "🚀 Starting AI Kanban board on port 3000..."
PORT=3000 npm run dev