# Image Generation in AI Kanban Board

This document describes how the image generation features work in the AI Kanban Board application, including the available models and configuration options.

## Models Available

The application supports two OpenAI image generation models:

1. **GPT-4o with Vision (gpt-image-1)** - The newest OpenAI model (as of May 13, 2025) for generating images, offering higher quality and more consistent results.

2. **DALL-E 3** - The previous generation model, which is more widely available and doesn't require organization verification.

## Configuration

The application is designed to automatically handle model selection and fallback behavior through environment variables:

- `PREFER_DALLE_FALLBACK` - Set to `true` to prefer using DALL-E 3 directly instead of trying gpt-image-1 first.

Default configuration in `.env`:
```
PREFER_DALLE_FALLBACK=true
```

This ensures the most reliable operation without requiring organization verification with OpenAI.

## How to Use

To generate images through the AI Kanban Board:

1. Add a card to a GPT-enabled column.
2. In the chat interface, describe the image you want to generate.
3. The AI will detect your request and generate an image accordingly.
4. The generated image will be attached to the card automatically.

Example image generation prompts:
- "Create an image of a serene mountain landscape with a waterfall and rainbow"
- "Generate an image of a futuristic city with flying cars"
- "Draw a picture of a tropical beach at sunset"

## Technical Details

### Model Selection and Fallback

The image generation system follows these steps:

1. Checks the `PREFER_DALLE_FALLBACK` environment variable
2. If `true`, uses DALL-E 3 directly
3. If `false`, attempts to use gpt-image-1 first
4. If gpt-image-1 fails (usually due to organization verification requirements), falls back to DALL-E 3

### Error Handling

The system automatically handles common errors:

- Organization verification requirements for gpt-image-1
- Parameter incompatibilities between models
- API rate limits and timeouts

### Response Format Handling

The system processes different response formats:

- URL-based responses (from DALL-E 3)
- Base64-encoded image data (from gpt-image-1)

## Troubleshooting

Common issues and solutions:

1. **Images not generating**
   - Verify your OpenAI API key is valid
   - Check that the card is in a GPT-enabled column
   - Ensure your prompt is clear and descriptive

2. **Organization verification errors**
   - This is expected for gpt-image-1 unless your OpenAI organization is verified
   - The system will automatically fall back to DALL-E 3

3. **Large image generation times**
   - Image generation can take 10-30 seconds depending on complexity
   - Wait for the processing indicator to complete

## Notes for Developers

When extending the image generation functionality:

1. The main implementation is in `server/openai.ts` in the `generateImage` function
2. Response handling logic can be found in the try/catch blocks in this function
3. Image attachment logic is in `handleFileGeneration` which processes the generated images
4. The system supports both URL-based and base64-encoded image responses

## Future Improvements

Planned enhancements:

1. Additional image customization options (style, aspect ratio)
2. Batch image generation
3. Image variation capabilities
4. Advanced prompt construction assistance