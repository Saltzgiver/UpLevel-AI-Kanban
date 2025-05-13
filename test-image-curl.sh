#!/bin/bash

# Simple test to generate an image using the chat API

# Configuration
API_URL="http://localhost:5000"
CARD_ID=101
PROMPT="a serene mountain landscape with a waterfall and rainbow"

echo "Creating a chat message to request image generation for card $CARD_ID..."
curl -X POST "$API_URL/api/chats" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"$PROMPT\",\"cardId\":$CARD_ID,\"role\":\"user\"}" \
  | jq .

echo "Triggering image generation processing..."
curl -X POST "$API_URL/api/cards/$CARD_ID/process-chat" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"$PROMPT\"}" \
  | jq .

echo "Waiting for processing to complete (15 seconds)..."
sleep 15

echo "Checking processing status..."
curl "$API_URL/api/cards/$CARD_ID/processing-status" | jq .

echo "Checking for new image attachments..."
curl "$API_URL/api/cards/$CARD_ID/attachments" | jq .

echo "Done testing image generation."
