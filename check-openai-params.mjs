/**
 * Verify OpenAI Image Generation Parameters
 * 
 * This script examines the server-side code to verify that image generation
 * is using the correct parameters (1024x1024 size, medium quality, gpt-image-1 model)
 */

import fs from 'fs';
import path from 'path';

// Path to server-side OpenAI code
const openaiFilePath = './server/openai.ts';

console.log('Checking image generation parameters in server-side code...');

try {
  const fileContent = fs.readFileSync(openaiFilePath, 'utf8');
  
  // Check image generation function parameters
  const defaultParamsMatch = fileContent.match(/size: "[^"]*" = "([^"]*)"/);
  const defaultSize = defaultParamsMatch ? defaultParamsMatch[1] : 'unknown';
  
  const defaultModelMatch = fileContent.match(/model: "[^|]*|"[^|]*|"[^"]*" = "([^"]*)"/);
  const defaultModel = defaultModelMatch ? defaultModelMatch[1] : 'unknown';
  
  const defaultQualityMatch = fileContent.match(/quality: "[^|]*|"[^|]*|"[^|]*|"[^"]*" = "([^"]*)"/);
  const defaultQuality = defaultQualityMatch ? defaultQualityMatch[1] : 'unknown';
  
  console.log('\nDefault Parameters in generateImage function:');
  console.log(`- Size: ${defaultSize}`);
  console.log(`- Model: ${defaultModel}`);
  console.log(`- Quality: ${defaultQuality}`);
  
  // Check actual image generation calls from processChat
  const callParamsMatch = fileContent.match(/const imageResult = await generateImage\(\s*imagePrompt,\s*column\.apiKey[^,]*,\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)"\s*\)/);
  
  if (callParamsMatch) {
    console.log('\nActual Parameters used in processChat call:');
    console.log(`- Size: ${callParamsMatch[1]}`);
    console.log(`- Model: ${callParamsMatch[2]}`);
    console.log(`- Quality: ${callParamsMatch[3]}`);
    
    // Check if the correct parameters are being used
    const usesCorrectSize = callParamsMatch[1] === '1024x1024';
    const usesCorrectModel = callParamsMatch[2] === 'gpt-image-1';
    const usesCorrectQuality = callParamsMatch[3] === 'medium';
    
    console.log('\nVerification Results:');
    console.log(`✓ Size is 1024x1024: ${usesCorrectSize ? 'YES' : 'NO'}`);
    console.log(`✓ Model is gpt-image-1: ${usesCorrectModel ? 'YES' : 'NO'}`);
    console.log(`✓ Quality is medium: ${usesCorrectQuality ? 'YES' : 'NO'}`);
    
    if (usesCorrectSize && usesCorrectModel && usesCorrectQuality) {
      console.log('\n✅ All parameters are correctly configured!');
    } else {
      console.log('\n❌ Some parameters do not match the requested configuration.');
    }
  } else {
    console.log('\n⚠️ Could not find image generation call in processChat function.');
  }
} catch (error) {
  console.error('Error reading file:', error);
}