#!/bin/bash

echo "🚀 Starting the AI Kanban board application..."

# Check if server is already running on port 5000
echo "Checking for existing processes on port 5000..."
if lsof -i :5000 > /dev/null; then
  echo "Found existing process on port 5000, killing it..."
  lsof -i :5000 | grep LISTEN | awk '{print $2}' | xargs -r kill -9
  sleep 1
fi

# Start the application
echo "Starting application with npm run dev..."
npm run dev