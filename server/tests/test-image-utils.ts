/**
 * Test Script for Image Utilities in server/openai.ts
 * 
 * This script tests the image utility functions:
 * - cleanBase64
 * - inferMimeTypeFromBuffer
 * 
 * To run: npx tsx test-image-utils.ts
 */

import { cleanBase64, inferMimeTypeFromBuffer } from './server/openai';

// Create sample data
const createTestPNG = (): Buffer => {
  // PNG signature: 89 50 4E 47
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  // Add some dummy IHDR data to make it look more real
  const ihdr = Buffer.from([0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
  
  return Buffer.concat([signature, ihdr]);
};

const createTestJPEG = (): Buffer => {
  // JPEG signature: FF D8 FF
  const signature = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]);
  
  return signature;
};

const createTestGIF = (): Buffer => {
  // GIF89a signature: 47 49 46 38 39 61
  const signature = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  
  return signature;
};

const createTestWebP = (): Buffer => {
  // WebP signature: RIFF + 4 bytes + WEBP
  const riff = Buffer.from([0x52, 0x49, 0x46, 0x46]);
  const fourBytes = Buffer.from([0x00, 0x00, 0x00, 0x00]); // Size placeholder
  const webp = Buffer.from([0x57, 0x45, 0x42, 0x50]);
  
  return Buffer.concat([riff, fourBytes, webp]);
};

/**
 * Test for cleanBase64 function
 */
const testCleanBase64 = () => {
  console.log('=== Testing cleanBase64 ===');
  
  // Valid base64 test
  const validBase64 = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64
  console.log(`Valid base64 input: ${validBase64}`);
  const cleanedValid = cleanBase64(validBase64);
  console.log(`Cleaned result: ${cleanedValid}`);
  console.log(`Test passed: ${cleanedValid === validBase64}\n`);
  
  // Base64 with whitespace
  const whitespaceBase64 = ' SGVs bG8g V29y bGQ= ';
  console.log(`Whitespace base64 input: "${whitespaceBase64}"`);
  const cleanedWhitespace = cleanBase64(whitespaceBase64);
  console.log(`Cleaned result: ${cleanedWhitespace}`);
  console.log(`Test passed: ${cleanedWhitespace === validBase64}\n`);
  
  // Base64 with invalid characters
  const invalidCharsBase64 = 'SGVs!bG8g*V29y@bGQ=';
  console.log(`Invalid chars base64 input: "${invalidCharsBase64}"`);
  const cleanedInvalidChars = cleanBase64(invalidCharsBase64);
  console.log(`Cleaned result: ${cleanedInvalidChars}`);
  console.log(`Test passed: ${cleanedInvalidChars === validBase64}\n`);
  
  // Base64 with incorrect padding
  const incorrectPaddingBase64 = 'SGVsbG8gV29ybGQ';
  console.log(`Incorrect padding base64 input: "${incorrectPaddingBase64}"`);
  const cleanedIncorrectPadding = cleanBase64(incorrectPaddingBase64);
  console.log(`Cleaned result: ${cleanedIncorrectPadding}`);
  console.log(`Test passed: ${cleanedIncorrectPadding === validBase64}\n`);
  
  // Very short base64 (should trigger minimum length warning)
  const shortBase64 = 'SGk='; // "Hi" in base64
  console.log(`Short base64 input: "${shortBase64}"`);
  const cleanedShort = cleanBase64(shortBase64);
  console.log(`Cleaned result: ${cleanedShort}`);
  console.log(`Test completed (should have shown a warning)\n`);
};

/**
 * Test for inferMimeTypeFromBuffer function
 */
const testInferMimeTypeFromBuffer = () => {
  console.log('=== Testing inferMimeTypeFromBuffer ===');
  
  // Test PNG detection
  const pngBuffer = createTestPNG();
  console.log(`Testing PNG detection with ${pngBuffer.length} bytes`);
  const pngMimeType = inferMimeTypeFromBuffer(pngBuffer);
  console.log(`Detected MIME type: ${pngMimeType}`);
  console.log(`Test passed: ${pngMimeType === 'image/png'}\n`);
  
  // Test JPEG detection
  const jpegBuffer = createTestJPEG();
  console.log(`Testing JPEG detection with ${jpegBuffer.length} bytes`);
  const jpegMimeType = inferMimeTypeFromBuffer(jpegBuffer);
  console.log(`Detected MIME type: ${jpegMimeType}`);
  console.log(`Test passed: ${jpegMimeType === 'image/jpeg'}\n`);
  
  // Test GIF detection
  const gifBuffer = createTestGIF();
  console.log(`Testing GIF detection with ${gifBuffer.length} bytes`);
  const gifMimeType = inferMimeTypeFromBuffer(gifBuffer);
  console.log(`Detected MIME type: ${gifMimeType}`);
  console.log(`Test passed: ${gifMimeType === 'image/gif'}\n`);
  
  // Test WebP detection
  const webpBuffer = createTestWebP();
  console.log(`Testing WebP detection with ${webpBuffer.length} bytes`);
  const webpMimeType = inferMimeTypeFromBuffer(webpBuffer);
  console.log(`Detected MIME type: ${webpMimeType}`);
  console.log(`Test passed: ${webpMimeType === 'image/webp'}\n`);
  
  // Test unknown format
  const unknownBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
  console.log(`Testing unknown format with ${unknownBuffer.length} bytes`);
  const unknownMimeType = inferMimeTypeFromBuffer(unknownBuffer);
  console.log(`Detected MIME type: ${unknownMimeType === null ? 'null' : unknownMimeType}`);
  console.log(`Test passed: ${unknownMimeType === null}\n`);
  
  // Test empty buffer
  const emptyBuffer = Buffer.alloc(0);
  console.log(`Testing empty buffer`);
  const emptyMimeType = inferMimeTypeFromBuffer(emptyBuffer);
  console.log(`Detected MIME type: ${emptyMimeType === null ? 'null' : emptyMimeType}`);
  console.log(`Test passed: ${emptyMimeType === null}\n`);
};

// Execute tests
try {
  console.log('=== IMAGE UTILS TEST SCRIPT ===');
  
  // Run the tests
  testCleanBase64();
  testInferMimeTypeFromBuffer();
  
  console.log('=== IMAGE UTILS TEST SCRIPT COMPLETE ===');
} catch (error) {
  console.error('Unexpected error running tests:', error);
}