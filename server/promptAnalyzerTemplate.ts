/**
 * Prompt Analyzer Template Manager
 * 
 * This module manages the template used by the prompt analyzer to generate prompt improvement suggestions.
 * It allows for persistent storage and dynamic updating of the template.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Define the template structure for type safety
export interface PromptAnalyzerTemplate {
  context: string;
  analysisGuidelines: string;
  columnSpecificGuidance: {
    imageGeneration: string;
    spreadsheetGeneration: string;
    textDrafting: string;
    contentRefinement: string;
  };
  responseFormat: string;
}

// In ES modules, __dirname is not available, so we need to recreate it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the template file
const templateFilePath = path.join(__dirname, 'prompt-analyzer-template.json');

// Default template
const defaultTemplate: PromptAnalyzerTemplate = {
  context: `You are a specialized AI designed to analyze card interactions and suggest improvements to column prompts in a Kanban board application. Your goal is to make AI interactions more efficient by improving the initial instructions.`,
  
  analysisGuidelines: `1. Identify patterns in the conversation that suggest the initial prompt could be improved
2. Look for clarification questions the user had to ask that could have been addressed in the initial prompt
3. Consider information that had to be extracted or explained that could be systematically incorporated
4. Focus on reusable patterns, not one-off requests or special cases
5. Consider if the conversation revealed misunderstandings about what the AI should do
6. Analyze the effectiveness of the responses and how they could be improved with better initial instructions`,
  
  columnSpecificGuidance: {
    imageGeneration: `Additional Guidelines for Image Generation:
- Consider if users frequently needed to specify style, composition, or lighting details
- Look for patterns in requested revisions to images (colors, angles, subjects)
- Identify if format specifications (resolution, aspect ratio) were missing
- Check if the prompt needs more guidance on maintaining visual consistency across multiple images`,
    
    spreadsheetGeneration: `Additional Guidelines for Data/Spreadsheet Generation:
- Identify if format specifications (CSV structure, headers) were missing or confusing
- Look for patterns in data organization requests (sorting, grouping)
- Consider if column types or data validation rules should be specified
- Check if the prompt needs clearer guidance on data formatting and computation rules`,
    
    textDrafting: `Additional Guidelines for Text Content Creation:
- Check if tone and voice guidance was missing or needed clarification
- Look for patterns in formatting requests (headings, bullet points, paragraphing)
- Identify if length guidelines were missing or insufficient
- Consider if the prompt should include specific structural elements (intro, conclusion, etc.)`,
    
    contentRefinement: `Additional Guidelines for Content Refinement:
- Look for patterns in what aspects needed refinement (clarity, brevity, technical accuracy)
- Check if the prompt needs clearer guidance on maintaining original meaning
- Identify if style guide adherence instructions were missing
- Consider if the level of editing (light, moderate, substantive) should be specified`
  },
  
  responseFormat: `First provide a detailed rationale for your suggestion on a single line starting with "RATIONALE: ".
Then, on a new line, provide your suggested prompt instructions.

Example:
RATIONALE: The original prompt lacked specific instructions about including environmental impact metrics, which the user had to request separately.
Create compelling marketing copy that emphasizes environmental impact metrics and sustainability benefits. Include specific numbers about waste reduction and carbon footprint when possible.

If no meaningful improvements can be made, simply respond with:
RATIONALE: No improvements needed because [your reasoning]
[original instructions]`
};

/**
 * Get the current template, creating a default if none exists
 */
export function getTemplate(): PromptAnalyzerTemplate {
  try {
    if (fs.existsSync(templateFilePath)) {
      const templateData = fs.readFileSync(templateFilePath, 'utf8');
      return JSON.parse(templateData);
    } else {
      // Create default template file if it doesn't exist
      fs.writeFileSync(templateFilePath, JSON.stringify(defaultTemplate, null, 2));
      return { ...defaultTemplate };
    }
  } catch (error) {
    console.error('Error reading prompt analyzer template:', error);
    return { ...defaultTemplate };
  }
}

/**
 * Save a new template
 */
export function saveTemplate(newTemplate: PromptAnalyzerTemplate): boolean {
  try {
    fs.writeFileSync(templateFilePath, JSON.stringify(newTemplate, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving prompt analyzer template:', error);
    return false;
  }
}

/**
 * Generate a meta-prompt using the template and conversation data
 */
export function generateMetaPrompt(
  template: PromptAnalyzerTemplate,
  sourceColumnInstructions: string,
  cardContext: { 
    title: string; 
    description: string | null; 
    attachments?: { filename: string; fileType: string }[] 
  },
  chats: any[],
  columnType: string = 'unknown'
): string {
  const attachments = cardContext.attachments || [];
  
  // Determine success patterns
  let successPatternGuidance = "";
  
  // Check for successful interactions in chat history
  if (chats.length > 0) {
    // Check for positive feedback from users
    const positiveResponses = chats.filter(chat => 
      chat.role === 'user' && 
      (chat.content.toLowerCase().includes("thank") || 
       chat.content.toLowerCase().includes("good job") ||
       chat.content.toLowerCase().includes("exactly") ||
       chat.content.toLowerCase().includes("perfect") ||
       chat.content.toLowerCase().includes("great"))
    );
    
    if (positiveResponses.length > 0) {
      successPatternGuidance = `
## Success Patterns
I've identified ${positiveResponses.length} instances where the user expressed satisfaction. 
Pay special attention to what made these interactions successful and incorporate these elements into your suggestion.`;
    }
  }
  
  // Include specific guidance based on column type
  let columnSpecificGuidance = "";
  
  switch (columnType) {
    case "image-generation":
      columnSpecificGuidance = template.columnSpecificGuidance.imageGeneration;
      break;
    case "spreadsheet-generation":
      columnSpecificGuidance = template.columnSpecificGuidance.spreadsheetGeneration;
      break;
    case "text-drafting":
      columnSpecificGuidance = template.columnSpecificGuidance.textDrafting;
      break;
    case "content-refinement":
      columnSpecificGuidance = template.columnSpecificGuidance.contentRefinement;
      break;
  }
  
  // Format meta-prompt that will guide the AI model
  const metaPrompt = `
# Prompt Improvement Assistant

## Context
${template.context}

## Your Task
Analyze the following information to identify potential improvements for the column's prompt instructions:

1. Current column prompt instructions
2. A card that was processed using these instructions
3. The conversation history between the user and AI for this card

## Current Column Prompt Instructions
\`\`\`
${sourceColumnInstructions || "No specific instructions provided"}
\`\`\`

## Card Details
- Title: ${cardContext.title}
- Description: ${cardContext.description || "No description provided"}
${attachments.length > 0 
  ? `- Attachments: ${attachments.map(a => `${a.filename} (${a.fileType})`).join(', ')}` 
  : '- No attachments'}

## Conversation History
${chats.map(chat => `${chat.role === 'assistant' ? 'AI' : 'User'}: ${chat.content}`).join('\n\n')}

## Analysis Guidelines
${template.analysisGuidelines}
${columnSpecificGuidance}
${successPatternGuidance}

## Response Format
${template.responseFormat}
`;

  return metaPrompt;
}

// Export the default template for reference
export { defaultTemplate };