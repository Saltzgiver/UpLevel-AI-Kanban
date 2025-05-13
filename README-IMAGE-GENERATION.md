# OpenAI Image Generation Integration

This README provides an overview of the OpenAI image generation integration in the AI Kanban Board application. The integration supports both the latest "gpt-image-1" model and DALL-E 3 with automatic fallback.

## Updates Made

1. **Model Support:**
   - Added support for OpenAI's latest "gpt-image-1" model (released May 2025)
   - Maintained DALL-E 3 compatibility as a fallback

2. **Environment Configuration:**
   - Added `PREFER_DALLE_FALLBACK` environment variable to control model selection
   - Configured to use DALL-E 3 by default for maximum compatibility

3. **Error Handling:**
   - Enhanced error detection and recovery
   - Added specific handling for organization verification requirements
   - Improved logging of API response information

4. **Response Format Handling:**
   - Automatically detects and processes different response formats (URL vs base64)
   - Handles content-type detection for proper file extension assignment

## Documentation

Detailed documentation is available in:
- `IMAGE_GENERATION_DOCS.md` - Complete user and developer documentation
- `examples/generate-image-example.js` - Example script demonstrating API usage

## Usage

To generate images in the application:

```javascript
// Example of generating an image through the API
const cardId = 101;
const imagePrompt = "Create an image of a mountain landscape with rainbow";

// Step 1: Create chat message requesting an image
await fetch('/api/chats', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cardId,
    content: imagePrompt,
    role: 'user'
  })
});

// Step 2: Trigger processing
await fetch(`/api/cards/${cardId}/process-chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: imagePrompt })
});

// Step 3: Wait for processing to complete and check for the image attachment
```

## Technical Implementation

The implementation provides several key features:

1. **Automatic Model Selection:**
   - Uses "gpt-image-1" when possible (faster, higher quality)
   - Falls back to DALL-E 3 when needed (wider availability)

2. **Parameter Compatibility:**
   - Adapts parameters based on the model being used
   - Removes unsupported parameters to prevent API errors

3. **Robust Error Handling:**
   - Catches and categorizes common API errors
   - Provides informative logging for troubleshooting

## Requirements

To use the "gpt-image-1" model:
- Organization verification with OpenAI is required
- If not verified, the system automatically falls back to DALL-E 3

## Future Work

1. **Additional Configuration Options:**
   - Image dimensions
   - Style preferences
   - Quality settings

2. **Enhanced UI Integration:**
   - Preview of generated images
   - Regeneration options
   - Style selection interface