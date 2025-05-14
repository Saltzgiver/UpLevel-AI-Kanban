#!/bin/bash

# Test script for image generation through the API using curl (raw output)
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
RESPONSE=$(curl -X POST "$HOST/api/cards/$CARD_ID/chats" \
  -H "Content-Type: application/json" \
  -d '{"content":"Generate an image of a cityscape with futuristic buildings","role":"user"}' \
  -s)
echo "Response: $RESPONSE"

echo "2. Checking processing status..."
# Poll the processing status a few times
for i in {1..15}; do
  echo "Attempt $i: Checking status..."
  RESPONSE=$(curl -s "$HOST/api/cards/$CARD_ID/processing-status")
  echo "Response: $RESPONSE"
  
  if [[ "$RESPONSE" == *"\"processing\":false"* ]]; then
    echo "Processing complete!"
    break
  fi
  
  echo "Card is still processing, waiting 3 seconds..."
  sleep 3
done

echo "3. Getting chats for card $CARD_ID..."
curl -s "$HOST/api/cards/$CARD_ID/chats" | tail -n 30

echo "4. Getting attachments for card $CARD_ID..."
curl -s "$HOST/api/cards/$CARD_ID/attachments" | tail -n 30

echo "===========================================" 
echo "Test completed"
echo "===========================================" 