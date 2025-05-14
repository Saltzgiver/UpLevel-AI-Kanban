import OpenAI from "openai";

/**
 * Generates an image using OpenAI's API
 */
export async function generateImage(
  prompt: string,
  apiKey?: string,
  size: string = "1024x1024",
  model: "gpt-image-1" | "dall-e-3" | "auto" = "auto",
  quality: "low" | "medium" | "high" | "auto" = "auto"
): Promise<{ base64: string; fileType: string, model: string }> {
  // Ensure we have an API key
  const openaiApiKey = apiKey || process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("No OpenAI API key provided");
  }

  // Initialize OpenAI client
  const openai = new OpenAI({ apiKey: openaiApiKey });

  // Determine the actual model to use
  let actualModel = model;
  if (model === "auto") {
    actualModel = "gpt-image-1"; // Default to newer model first, then fallback if needed
  }

  console.log(`[IMAGE-GEN] Generating image with prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
  console.log(`[IMAGE-GEN] Using model: ${actualModel} (Originally requested: ${model})`);
  console.log(`[IMAGE-GEN] Size: ${size}, Quality: ${quality}`);

  try {
    if (actualModel === 'gpt-image-1') {
      // Try the newer gpt-image-1 model first
      console.log(`[IMAGE-GEN] Using gpt-image-1 model for image generation`);
      console.log(`[IMAGE-GEN] Parameters: model=gpt-image-1, quality=${quality}, size=${size}`);
      
      // Mark the start time to measure API response time
      const startTime = Date.now();
      console.log(`[IMAGE-GEN] Starting API call at: ${new Date().toISOString()}`);
      
      // Prepare parameters for the API call
      const imagenParams: any = {
        model: "gpt-image-1",
        prompt: prompt,
        n: 1,
        size: size,
        response_format: "b64_json" // This is the key change - gpt-image-1 DOES support b64_json
      };
      
      // Only add quality if it's not auto
      if (quality !== "auto") {
        imagenParams.quality = quality;
      }
      
      console.log(`[IMAGE-GEN] Full API parameters for gpt-image-1: ${JSON.stringify(imagenParams)}`);
      
      try {
        // Call OpenAI API with gpt-image-1 model with response_format=b64_json
        const imagenResult = await openai.images.generate(imagenParams);
        
        // Calculate response time
        const endTime = Date.now();
        const responseTime = (endTime - startTime) / 1000;
        console.log(`[IMAGE-GEN] API response received after ${responseTime.toFixed(2)} seconds`);
        
        // Log response structure
        console.log(`[IMAGE-GEN] API response structure: ${JSON.stringify(Object.keys(imagenResult))}`);
        console.log(`[IMAGE-GEN] Response data type: ${typeof imagenResult.data}`);
        console.log(`[IMAGE-GEN] Response data length: ${Array.isArray(imagenResult.data) ? imagenResult.data.length : 'not an array'}`);
        
        // Check for data
        if (!imagenResult?.data || !Array.isArray(imagenResult.data) || imagenResult.data.length === 0) {
          throw new Error("No image data returned from API");
        }
        
        // Get the first data item
        const imageData = imagenResult.data[0];
        console.log(`[IMAGE-GEN] Image data keys: ${JSON.stringify(Object.keys(imageData))}`);
        
        // Check for base64 data
        if (!imageData.b64_json) {
          throw new Error("No base64 data found in API response. Data keys: " + JSON.stringify(Object.keys(imageData)));
        }
        
        const base64Data = imageData.b64_json;
        console.log(`[IMAGE-GEN] Successfully received base64 data from gpt-image-1 with length: ${base64Data.length}`);
        
        // Clean the base64 data
        const cleanedBase64 = cleanBase64(base64Data);
        
        // Try to infer MIME type from base64 data
        let mimeType = 'image/png'; // Default MIME type
        try {
          // Decode a small portion of the base64 to check the file signature
          const buffer = Buffer.from(cleanedBase64.substring(0, 100), 'base64');
          const inferredType = inferMimeTypeFromBuffer(buffer);
          
          if (inferredType) {
            console.log(`[IMAGE-GEN] Using inferred MIME type: ${inferredType}`);
            mimeType = inferredType;
          } else {
            console.log(`[IMAGE-GEN] Could not infer MIME type, using default: ${mimeType}`);
          }
        } catch (inferError) {
          console.error(`[IMAGE-GEN] Error inferring MIME type:`, inferError);
        }
        
        // Return the result
        return { 
          base64: cleanedBase64, 
          fileType: mimeType,
          model: "gpt-image-1"
        };
      } catch (imagenError) {
        console.error(`[IMAGE-GEN] Error with gpt-image-1:`, imagenError);
        throw imagenError;
      }
    } else {
      // Use DALL-E 3 model directly
      console.log(`[IMAGE-GEN] Using dall-e-3 model for image generation`);
      console.log(`[IMAGE-GEN] Parameters: model=dall-e-3, response_format=b64_json, n=1, size=${size}`);
      
      // Mark the start time to measure API response time
      const startTime = Date.now();
      console.log(`[IMAGE-GEN] Starting API call at: ${new Date().toISOString()}`);
      
      try {
        // Call OpenAI API with dall-e-3 model
        const dalleResult = await openai.images.generate({
          model: "dall-e-3",
          prompt: prompt,
          n: 1,
          size: size as "1024x1024" | "1792x1024" | "1024x1792" | "1536x1024" | "1024x1536",
          response_format: "b64_json"
        });
        
        // Calculate response time
        const endTime = Date.now();
        const responseTime = (endTime - startTime) / 1000;
        console.log(`[IMAGE-GEN] API response received after ${responseTime.toFixed(2)} seconds`);
        
        // Log response structure
        console.log(`[IMAGE-GEN] API response structure: ${JSON.stringify(Object.keys(dalleResult))}`);
        
        // Check for data
        if (!dalleResult?.data || !Array.isArray(dalleResult.data) || dalleResult.data.length === 0) {
          throw new Error("No image data returned from API");
        }
        
        // Get the base64 data from the response
        const imageData = dalleResult.data[0];
        if (!imageData || !imageData.b64_json) {
          throw new Error("No base64 image data returned from API");
        }
        
        const base64Data = imageData.b64_json;
        console.log(`[IMAGE-GEN] Successfully received base64 data with length: ${base64Data.length}`);
        
        // Clean the base64 data
        const cleanedBase64 = cleanBase64(base64Data);
        
        // Try to infer MIME type from base64 data
        let mimeType = 'image/png'; // Default MIME type
        try {
          // Decode a small portion of the base64 to check the file signature
          const buffer = Buffer.from(cleanedBase64.substring(0, 100), 'base64');
          const inferredType = inferMimeTypeFromBuffer(buffer);
          
          if (inferredType) {
            console.log(`[IMAGE-GEN] Using inferred MIME type: ${inferredType}`);
            mimeType = inferredType;
          } else {
            console.log(`[IMAGE-GEN] Could not infer MIME type, using default: ${mimeType}`);
          }
        } catch (inferError) {
          console.error(`[IMAGE-GEN] Error inferring MIME type:`, inferError);
        }
        
        // Return the result
        return { 
          base64: cleanedBase64, 
          fileType: mimeType,
          model: "dall-e-3"
        };
      } catch (dalleError) {
        console.error(`[IMAGE-GEN] Error with DALL-E 3:`, dalleError);
        throw dalleError;
      }
    }
  } catch (error) {
    console.error(`[IMAGE-GEN] Error with primary model ${actualModel}:`, error);
  
    // If we're already using DALL-E 3 or auto-selection is disabled, throw the error
    if (actualModel === 'dall-e-3' || model !== 'auto') {
      throw error;
    }
    
    // If we're using auto mode and gpt-image-1 failed, try falling back to DALL-E 3
    console.log(`[IMAGE-GEN] Falling back to dall-e-3 model`);
    return generateImage(prompt, apiKey, size, "dall-e-3", quality);
  }
}

/**
 * Utility function to clean up base64 data by removing any header information
 */
function cleanBase64(base64Data: string): string {
  // Strip any data URL prefixes (like data:image/png;base64,)
  if (base64Data.includes(',')) {
    return base64Data.split(',')[1];
  }
  return base64Data;
}

/**
 * Utility function to infer MIME type from file headers
 */
function inferMimeTypeFromBuffer(buffer: Buffer): string | null {
  // Check for PNG signature
  if (buffer.length >= 8 && 
      buffer[0] === 0x89 && 
      buffer[1] === 0x50 && 
      buffer[2] === 0x4E && 
      buffer[3] === 0x47) {
    return 'image/png';
  }
  
  // Check for JPEG signature
  if (buffer.length >= 3 && 
      buffer[0] === 0xFF && 
      buffer[1] === 0xD8 && 
      buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // Check for WebP signature
  if (buffer.length >= 12 && 
      buffer[0] === 0x52 && 
      buffer[1] === 0x49 && 
      buffer[2] === 0x46 && 
      buffer[3] === 0x46 && 
      buffer[8] === 0x57 && 
      buffer[9] === 0x45 && 
      buffer[10] === 0x42 && 
      buffer[11] === 0x50) {
    return 'image/webp';
  }
  
  // Unknown signature
  return null;
}