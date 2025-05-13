/**
 * Utility functions for image handling
 */

/**
 * Infers the MIME type from a buffer by checking the magic bytes
 * @param buffer The buffer to check
 * @returns The detected MIME type or null if not recognized
 */
export function inferMimeTypeFromBuffer(buffer: ArrayBuffer): string | null {
  // Create a view to examine the first few bytes
  const arr = new Uint8Array(buffer);
  
  // Need at least 4 bytes to check signatures
  if (arr.length < 4) {
    return null;
  }
  
  // JPEG signature: starts with FF D8 FF
  if (arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) {
    return 'image/png';
  }
  
  // GIF signature: "GIF87a" or "GIF89a"
  if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46 &&
      arr[3] === 0x38 && (arr[4] === 0x37 || arr[4] === 0x39) && arr[5] === 0x61) {
    return 'image/gif';
  }
  
  // WebP signature: starts with "RIFF" and has "WEBP" at offset 8
  if (arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46 &&
      arr.length >= 12 && 
      arr[8] === 0x57 && arr[9] === 0x45 && arr[10] === 0x42 && arr[11] === 0x50) {
    return 'image/webp';
  }
  
  // SVG: Usually starts with "<?xml" or "<svg"
  // This is a text format so we need to check for text patterns
  const textCheck = new TextDecoder().decode(arr.slice(0, Math.min(arr.length, 100)));
  if (textCheck.includes('<svg') || (textCheck.includes('<?xml') && textCheck.includes('<svg'))) {
    return 'image/svg+xml';
  }
  
  // BMP signature: starts with "BM"
  if (arr[0] === 0x42 && arr[1] === 0x4D) {
    return 'image/bmp';
  }
  
  // TIFF signature: starts with "II*\0" or "MM\0*"
  if ((arr[0] === 0x49 && arr[1] === 0x49 && arr[2] === 0x2A && arr[3] === 0x00) ||
      (arr[0] === 0x4D && arr[1] === 0x4D && arr[2] === 0x00 && arr[3] === 0x2A)) {
    return 'image/tiff';
  }
  
  return null;
}

/**
 * Cleans up a base64 string by removing unwanted characters
 * @param base64 The base64 string to clean
 * @returns A clean base64 string
 */
export function cleanupBase64(base64: string): string {
  // Remove data URL prefix if present
  let cleaned = base64;
  
  // Remove any data URL prefix (e.g., "data:image/png;base64,")
  if (cleaned.includes('base64,')) {
    cleaned = cleaned.split('base64,')[1];
  }
  
  // Remove any whitespace, newlines or carriage returns
  cleaned = cleaned.replace(/[\r\n\t\f\v ]/g, '');
  
  // Handle alternative characters some APIs might use
  cleaned = cleaned.replace(/-/g, '+').replace(/_/g, '/');
  
  // Ensure padding is correct (must be a multiple of 4)
  while (cleaned.length % 4 !== 0) {
    cleaned += '=';
  }
  
  return cleaned;
}

/**
 * Converts a base64 string to a data URL
 * @param base64 The base64 string
 * @param mimeType The MIME type (defaults to image/png if not provided)
 * @returns A data URL
 */
export function base64ToDataUrl(base64: string, mimeType: string = 'image/png'): string {
  // Check if it's already a data URL
  if (base64.startsWith('data:')) {
    return base64;
  }
  
  // Clean the base64 string
  const cleaned = cleanupBase64(base64);
  
  // Return as data URL
  return `data:${mimeType};base64,${cleaned}`;
}