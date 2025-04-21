/**
 * Google Docs Handler for OpenAI Function Calling
 * 
 * This module provides functionality to:
 * 1. Generate OpenAI function definitions for Google Docs search
 * 2. Process function calls to search for Google Docs
 * 3. Integrate with the Zapier MCP client
 */

import { runMcpAction } from './mcpClient';
import { log } from './vite';

/**
 * Google Docs search function definition for OpenAI
 */
export const GOOGLE_DOCS_FUNCTION_DEF = {
  name: "find_google_doc",
  description: "Search for a Google Doc by name or content",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query - document name or keywords to find in Google Docs"
      }
    },
    required: ["query"]
  }
};

/**
 * Process a Google Docs search function call from OpenAI
 * 
 * @param args The arguments from the function call
 * @returns A formatted response with search results
 */
export async function handleGoogleDocsSearch(args: any): Promise<string> {
  try {
    const { query } = args;
    
    if (!query) {
      return "Error: Search query is required to find Google Docs.";
    }
    
    log(`Searching for Google Doc with query: "${query}"`);
    
    // Use Zapier MCP to search for the document
    const result = await runMcpAction(
      'google_docs.find_document',
      { query }
    );
    
    if (!result || !result.success) {
      return `I tried to search for Google Docs with "${query}", but no results were found.`;
    }
    
    // Format the response based on the search results
    if (result.documents && Array.isArray(result.documents) && result.documents.length > 0) {
      // Multiple documents found
      const docList = result.documents.map((doc: any, index: number) => {
        return `${index + 1}. ${doc.name} - ${doc.url || 'No URL available'}`;
      }).join('\n');
      
      return `I found the following Google Docs matching "${query}":\n\n${docList}`;
    } else if (result.document) {
      // Single document found
      const doc = result.document;
      return `I found the Google Doc "${doc.name}".\n\nURL: ${doc.url || 'No URL available'}`;
    } else if (result.external_url) {
      // Basic result with just a URL
      return `I found a Google Doc matching "${query}".\n\nURL: ${result.external_url}`;
    } else {
      // Generic success but no structured data
      return `I searched for "${query}" in Google Docs, but the result format was unexpected. Please try a more specific search term.`;
    }
  } catch (error: any) {
    log(`Error handling Google Docs search: ${error}`);
    return `I attempted to search for Google Docs, but encountered an error: ${error.message || 'Unknown error'}`;
  }
}