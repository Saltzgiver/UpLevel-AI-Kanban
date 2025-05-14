#!/bin/bash

# Test script for image generation through the API using curl
# This script:
# 1. Creates a chat message requesting an image
# 2. Waits for processing to complete
# 3. Shows the latest chats and attachments

# Test parameters
CARD_ID=94
HOST="http://localhost:5000"

echo "===========================================" 
echo "Testing image generation with card ID: $CARD_ID"
echo "===========================================" 

# Create the chat message with image generation request
echo "1. Creating chat message requesting an image..." 
curl -X POST "$HOST/api/cards/$CARD_ID/chats" \
  -H "Content-Type: application/json" \
  -d '{"content":"Generate an image of a mountain landscape at sunset","role":"user"}' \
  -s | jq '.'

echo "2. Checking processing status..."
# Poll the processing status a few times
for i in {1..30}; do
  echo "Attempt $i: Checking status..."
  PROCESSING=$(curl -s "$HOST/api/cards/$CARD_ID/processing-status" | jq -r '.processing')
  
  echo "Processing status: $PROCESSING"
  
  if [ "$PROCESSING" = "false" ]; then
    echo "Processing complete!"
    break
  fi
  
  echo "Card is still processing, waiting 2 seconds..."
  sleep 2
done

# Get the most recent chats to verify the result
echo "3. Getting recent chats for card $CARD_ID..."
curl -s "$HOST/api/cards/$CARD_ID/chats" | jq -r '.[] | select(.role=="assistant") | "\n[Assistant]\nContent: \(.content)\nTimestamp: \(.timestamp)\nGPT Name: \(.gptName // "N/A")"' | head -n 20

# Get attachments to verify the image was created
echo "4. Getting attachments for card $CARD_ID..."
curl -s "$HOST/api/cards/$CARD_ID/attachments" | jq -r '.[] | select(.fileType | startswith("image")) | "\n[Image]\nID: \(.id)\nFilename: \(.filename)\nFile Type: \(.fileType)\nCreated At: \(.createdAt)\nURL: /api/attachments/\(.id)"'

echo "===========================================" 
echo "Test completed"
echo "===========================================" 