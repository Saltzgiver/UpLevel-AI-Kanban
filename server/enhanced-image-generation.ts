import OpenAI from "openai";
import { inferMimeTypeFromBuffer, cleanupBase64, base64ToDataUrl } from './image-helpers';

/**
 * Get OpenAI client (simplified version from openai.ts)
 */
export const getOpenAIClient = (apiKey?: string) => {
  // Special handling for "from_env" value or undefined apiKey
  console.log(`[ENHANCED-IMAGE-GEN] Creating OpenAI client with apiKey: ${apiKey ? (apiKey === "from_env" ? "from_env" : "custom key provided") : "undefined"}`);
  
  try {
    // First, try to use a directly provided API key
    if (apiKey && apiKey !== "from_env") {
      console.log("[ENHANCED-IMAGE-GEN] Using custom API key from column settings");
      return new OpenAI({ apiKey: apiKey });
    }
    
    // Otherwise, use the environment variable
    console.log("[ENHANCED-IMAGE-GEN] Using environment variable for OpenAI API key");
    
    // Directly check if the environment variable is accessible
    if (!process.env.OPENAI_API_KEY) {
      console.error("[ENHANCED-IMAGE-GEN] OPENAI_API_KEY environment variable is not defined or empty");
      throw new Error("OpenAI API key not found in environment variables");
    }
    
    return new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY
    });
  } catch (error) {
    console.error("[ENHANCED-IMAGE-GEN] Error creating OpenAI client:", error);
    throw error;
  }
};

/**
 * Enhanced image generation function with improved validation and error handling
 * This implementation addresses the issues described in the PRD
 */
export async function enhancedGenerateImage(prompt: string, apiKey?: string): Promise<string> {
  try {
    // Special handling for "from_env" value to use environment variable
    if (apiKey === "from_env") {
      apiKey = undefined; // Will use process.env.OPENAI_API_KEY
    }
    
    const openai = getOpenAIClient(apiKey);
    
    // Log useful information for debugging
    console.log(`[ENHANCED-IMAGE-GEN] Generating image with prompt: "${prompt.substring(0, 50)}..."`);
    console.log(`[ENHANCED-IMAGE-GEN] Using API key source: ${apiKey ? 'column-specific key' : 'environment variable'}`);
    
    // Use the new gpt-image-1 model by default (latest model as of May 2025)
    // Try to use gpt-image-1 first, with fallback to dall-e-3
    // Default to false for preferFallback unless explicitly set to true
    const preferFallback = process.env.PREFER_DALLE_FALLBACK === 'true';
    
    // Select the initial model to try
    const modelToUse = preferFallback ? "dall-e-3" : "gpt-image-1";
    
    console.log(`[ENHANCED-IMAGE-GEN] Using image generation model: ${modelToUse} (fallback preference: ${preferFallback ? 'enabled' : 'disabled'})`);
    
    // Build the request parameters based on the model
    let requestParams: any;
    
    if (modelToUse === "gpt-image-1") {
      // gpt-image-1 specific options with correct types
      requestParams = {
        model: "gpt-image-1" as const,
        prompt,
        n: 1,
        size: "1024x1024" as const // Standard size compatible with both models
      };
    } else {
      // dall-e-3 specific options with correct types
      requestParams = {
        model: "dall-e-3" as const,
        prompt,
        n: 1,
        size: "1024x1024" as const,
        quality: "standard" as const,
        response_format: "url" as const
      };
    }
    
    console.log(`[ENHANCED-IMAGE-GEN] Generating image with params:`, JSON.stringify(requestParams, null, 2));
    const response = await openai.images.generate(requestParams);

    console.log(`[ENHANCED-IMAGE-GEN] Successfully generated image with ${modelToUse}`);
    console.log(`[ENHANCED-IMAGE-GEN] Response data format: ${JSON.stringify(response.data ? Object.keys(response.data[0]) : 'No data')}`);
    
    // Handle response format
    if (!response.data || response.data.length === 0) {
      console.error(`[ENHANCED-IMAGE-GEN] No data in response: ${JSON.stringify(response)}`);
      throw new Error("No image data returned from API");
    }
    
    // Handle URL format (both models can return this)
    if (response.data[0].url) {
      console.log(`[ENHANCED-IMAGE-GEN] URL format detected, URL length: ${response.data[0].url.length}`);
      console.log(`[ENHANCED-IMAGE-GEN] URL starts with: ${response.data[0].url.substring(0, 30)}...`);
      return response.data[0].url;
    }
    
    // Handle base64 format
    if (response.data[0].b64_json) {
      let base64Image = response.data[0].b64_json;
      console.log(`[ENHANCED-IMAGE-GEN] Base64 format detected, length: ${base64Image.length}`);
      
      try {
        // Clean up the base64 string using our helper function
        base64Image = cleanupBase64(base64Image);
        
        // Detect image format from the base64 data
        let imageFormat = 'png'; // Default format
        
        try {
          // Decode a small portion to check the signature
          const byteSignature = Buffer.from(base64Image.substring(0, 32), 'base64');
          const mimeType = inferMimeTypeFromBuffer(byteSignature);
          
          if (mimeType) {
            // Extract format from mime type (e.g., "image/png" → "png")
            imageFormat = mimeType.split('/')[1];
            console.log(`[ENHANCED-IMAGE-GEN] Detected ${imageFormat} format from base64 signature`);
          } else {
            console.log(`[ENHANCED-IMAGE-GEN] Could not detect image format, using default (png)`);
          }
        } catch (formatError) {
          console.error(`[ENHANCED-IMAGE-GEN] Error detecting image format: ${formatError}`);
          // Continue with default format
        }
        
        // Return as data URL
        return `data:image/${imageFormat};base64,${base64Image}`;
      } catch (cleanupError) {
        console.error(`[ENHANCED-IMAGE-GEN] Error processing base64 data: ${cleanupError}`);
        // Return original base64 with default format if cleanup fails
        return `data:image/png;base64,${response.data[0].b64_json}`;
      }
    }
    
    console.error(`[ENHANCED-IMAGE-GEN] Unknown response format: ${JSON.stringify(response.data[0])}`);
    throw new Error("No valid image format found in API response");
    
  } catch (error) {
    // Format error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ENHANCED-IMAGE-GEN] Error generating image: ${errorMessage}`);
    
    // Add specific handling for common gpt-image-1 errors
    let fallbackReason = "Error with primary model";
    if (errorMessage.includes("organization must be verified")) {
      fallbackReason = "Organization verification required for gpt-image-1";
    } else if (errorMessage.includes("Unknown parameter")) {
      fallbackReason = "Incompatible parameter for gpt-image-1";
    } else if (errorMessage.includes("Maximum context length")) {
      fallbackReason = "Prompt too long for gpt-image-1";
    }
    
    // If the gpt-image-1 model fails, attempt to fall back to dall-e-3
    try {
      console.log(`[ENHANCED-IMAGE-GEN] Attempting fallback to dall-e-3 model... (Reason: ${fallbackReason})`);
      const openai = getOpenAIClient(apiKey);
      
      // Fallback to dall-e-3 with appropriate params
      const fallbackParams = { 
        model: "dall-e-3" as const,
        prompt,
        n: 1,
        size: "1024x1024" as const,
        quality: "standard" as const, 
        response_format: "url" as const // dall-e-3 works better with URL format
      };
      
      console.log(`[ENHANCED-IMAGE-GEN] Generating fallback image with params:`, JSON.stringify(fallbackParams, null, 2));
      const response = await openai.images.generate(fallbackParams);
      
      console.log("[ENHANCED-IMAGE-GEN] Successfully generated image with dall-e-3 fallback");
      
      // Handle dall-e-3 output format
      if (!response.data || response.data.length === 0) {
        console.error(`[ENHANCED-IMAGE-GEN] No data in fallback response: ${JSON.stringify(response)}`);
        throw new Error("No image data returned from API in fallback");
      }
      
      // dall-e-3 uses URL format by default
      if (response.data[0].url) {
        console.log(`[ENHANCED-IMAGE-GEN] Fallback URL format detected, URL length: ${response.data[0].url.length}`);
        return response.data[0].url;
      }
      
      // Handle b64_json if response_format was set to that
      if (response.data[0].b64_json) {
        let base64Image = response.data[0].b64_json;
        console.log(`[ENHANCED-IMAGE-GEN] Fallback Base64 format detected, length: ${base64Image.length}`);
        
        try {
          // Clean up the base64 string
          base64Image = cleanupBase64(base64Image);
          
          // Return as data URL with default format
          return `data:image/png;base64,${base64Image}`;
        } catch (cleanupError) {
          console.error(`[ENHANCED-IMAGE-GEN] Error cleaning up fallback base64: ${cleanupError}`);
          // Return original base64 if cleanup fails
          return `data:image/png;base64,${response.data[0].b64_json}`;
        }
      }
      
      console.error(`[ENHANCED-IMAGE-GEN] Unknown fallback response format: ${JSON.stringify(response.data[0])}`);
      throw new Error("No valid image format found in fallback API response");
    } catch (fallbackError) {
      console.error("[ENHANCED-IMAGE-GEN] Error with fallback image generation:", fallbackError);
      throw error; // Throw the original error
    }
  }
}