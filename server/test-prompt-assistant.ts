/**
 * Test implementation of the prompt suggestion mechanism
 * This module provides a simplified implementation that always returns
 * test suggestions without requiring an OpenAI API key
 */

import { Chat, Attachment } from "@shared/schema";

/**
 * Type for the suggestion object
 */
export interface PromptSuggestion {
  rationale: string;
  suggestedInstructions: string;
}

/**
 * Always returns a test suggestion without calling OpenAI API
 */
export function getTestPromptSuggestion(
  sourceColumnInstructions: string,
  cardContext: { title: string; description: string | null; attachments?: any[] },
  chats: Chat[]
): PromptSuggestion | null {
  // Log for debugging
  console.log(`[PROMPT ASSISTANT] Generating test suggestion for card: ${cardContext.title}`);
  
  // Check if we should simulate no suggestion
  const cardContextLower = (cardContext.description || "").toLowerCase();
  if (cardContextLower.includes("no suggestion") || cardContextLower.includes("nosuggest")) {
    console.log(`[PROMPT ASSISTANT] Card contains 'no suggestion' keyword - simulating no suggestion available`);
    return null;
  }
  
  // For any other card, create a mock suggestion for testing
  const testSuggestion: PromptSuggestion = {
    rationale: `Based on my analysis of the interactions with this card titled "${cardContext.title}", I've identified several areas where the instructions could be improved to provide more specific guidance.`,
    suggestedInstructions: `# Improved Instructions for ${cardContext.title}\n\nAs an AI assistant, your task is to:\n\n1. Analyze the user's request thoroughly\n2. Provide structured, well-organized responses\n3. Use clear examples when explaining complex concepts\n4. Maintain a helpful and conversational tone throughout\n\n${sourceColumnInstructions}`
  };
  
  console.log(`[PROMPT ASSISTANT] Generated test suggestion with ${testSuggestion.suggestedInstructions.length} characters`);
  return testSuggestion;
}