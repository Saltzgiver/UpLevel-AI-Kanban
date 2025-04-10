import { storage } from "./storage";

/**
 * Enhanced CSV attachment handler with detailed logging
 * To be used to diagnose issues with CSV attachments
 */
export async function createCSVAttachmentFromText(cardId: number, csvText: string, filename?: string): Promise<boolean> {
  console.log(`CSV-HELPER: Creating CSV attachment for card ${cardId}`);
  console.log(`CSV-HELPER: CSV content length: ${csvText.length} characters`);
  
  try {
    // Clean up the content
    const cleanContent = csvText.trim();
    const csvLines = cleanContent.split('\n');
    
    console.log(`CSV-HELPER: CSV has ${csvLines.length} lines`);
    if (csvLines.length > 0) {
      console.log(`CSV-HELPER: First line: ${csvLines[0]}`);
      if (csvLines.length > 1) {
        console.log(`CSV-HELPER: Second line: ${csvLines[1]}`);
      }
    } else {
      console.log(`CSV-HELPER: WARNING - CSV appears to be empty or invalid`);
    }
    
    // Generate a unique filename if none provided
    const csvFilename = filename || `data_${Date.now()}.csv`;
    console.log(`CSV-HELPER: Using filename: ${csvFilename}`);
    
    // Create the attachment
    const attachment = await storage.createAttachment({
      cardId,
      filename: csvFilename,
      fileType: 'text/csv',
      content: cleanContent
    });
    
    console.log(`CSV-HELPER: Successfully created CSV attachment with ID: ${attachment.id}`);
    return true;
  } catch (error) {
    console.error(`CSV-HELPER: Error creating CSV attachment:`, error);
    return false;
  }
}

/**
 * Extracts CSV content from a GPT response using multiple patterns
 */
export function extractCSVContent(response: string): { content: string, format: string } | null {
  console.log(`CSV-HELPER: Attempting to extract CSV content from response of length ${response.length}`);
  
  // Check various patterns
  
  // 1. Standard file attachment format
  const fileRegex = /```(?:file|attachment):([^,]+\.csv),\s*(?:text\/csv|csv),\s*([^`]+)```/gi;
  let match = fileRegex.exec(response);
  if (match) {
    console.log(`CSV-HELPER: Found standard file attachment format for CSV`);
    return { content: match[2].trim(), format: 'standard' };
  }
  
  // 2. Simple CSV code block
  const csvBlockRegex = /```csv\s*\n([\s\S]*?)\n```/gi;
  match = csvBlockRegex.exec(response);
  if (match) {
    console.log(`CSV-HELPER: Found CSV code block`);
    return { content: match[1].trim(), format: 'code-block' };
  }
  
  // 3. Any code block that might contain CSV content
  const anyBlockRegex = /```([\s\S]*?)```/gi;
  const allBlocks = [];
  let anyMatch;
  while ((anyMatch = anyBlockRegex.exec(response)) !== null) {
    allBlocks.push(anyMatch[1].trim());
  }
  
  // Check all code blocks for CSV-like content
  for (const block of allBlocks) {
    const lines = block.split('\n');
    if (lines.length > 1) {
      // Check if this looks like a CSV (contains commas and has multiple lines)
      const commaCount = (lines[0].match(/,/g) || []).length;
      if (commaCount > 0) {
        console.log(`CSV-HELPER: Found potential CSV content in code block (${commaCount} commas in header)`);
        return { content: block, format: 'extracted' };
      }
    }
  }
  
  // 4. Look for plaintext CSV-like content (fallback)
  const paragraphs = response.split('\n\n');
  for (const para of paragraphs) {
    const lines = para.split('\n');
    if (lines.length > 2) { // At least 3 lines for a meaningful CSV
      // Check if consistently formatted with commas
      const commaCountFirst = (lines[0].match(/,/g) || []).length;
      const commaCountSecond = (lines[1].match(/,/g) || []).length;
      if (commaCountFirst > 0 && commaCountFirst === commaCountSecond) {
        console.log(`CSV-HELPER: Found potential plaintext CSV content (${lines.length} lines)`);
        return { content: para, format: 'plaintext' };
      }
    }
  }
  
  console.log(`CSV-HELPER: No CSV content found in response`);
  return null;
}