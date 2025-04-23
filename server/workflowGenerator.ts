import { getOpenAIClient } from "./openai";
import OpenAI from "openai";
import { storage } from "./storage";

// Default system prompt if no custom one is found in settings
export const DEFAULT_SYSTEM_PROMPT = `You are an expert workflow designer. Your task is to help users create effective Kanban boards by analyzing their workflow description and generating appropriate columns.

For each workflow, create:
1. A concise, descriptive board name
2. 3-6 columns that represent the stages in the workflow
3. For each column, decide if it should have an AI assistant assigned to it
4. For columns with AI assistants, provide a friendly AI name and detailed instructions

When designing the workflow:
- Standard columns like "Backlog", "In Progress", "Done" should be included when appropriate
- AI assistants should be assigned to columns where automated processing, analysis, or guidance would be valuable
- Instructions for AI assistants should be specific and actionable
- The AI name should be short and reflect the assistant's purpose (e.g., "Editor", "Reviewer")

Return the response in the exact JSON format shown below:
{
  "boardName": "Name of the Board",
  "columns": [
    {
      "name": "Column Name",
      "gptAssigned": true/false,
      "gptName": "AI Assistant Name",
      "gptInstructions": "Detailed instructions for the AI assistant"
    },
    // More columns...
  ]
}`;

/**
 * Get the system prompt from settings or use default
 */
async function getSystemPrompt(): Promise<string> {
  try {
    const setting = await storage.getSetting("workflow_system_prompt");
    return setting?.value ? setting.value : DEFAULT_SYSTEM_PROMPT;
  } catch (error) {
    console.error("Error getting workflow system prompt from settings:", error);
    return DEFAULT_SYSTEM_PROMPT;
  }
}

/**
 * Interface for a generated column in the workflow
 */
interface GeneratedColumn {
  name: string;
  gptAssigned: boolean;
  gptName: string;
  gptInstructions: string;
}

/**
 * Response interface for the workflow generation
 */
interface GenerateWorkflowResponse {
  boardName: string;
  columns: GeneratedColumn[];
}

/**
 * Generate kanban board columns from a workflow description using OpenAI
 * 
 * @param description Natural language description of the workflow
 * @returns Generated board name and columns
 */
export async function generateWorkflowColumns(description: string): Promise<GenerateWorkflowResponse> {
  try {
    // Initialize OpenAI client
    const openai = getOpenAIClient();
    
    console.log(`Generating workflow columns from description: "${description.substring(0, 100)}..."`);
    
    // Get the system prompt from settings
    const systemPrompt = await getSystemPrompt();

    // Create the user message with the workflow description
    const userMessage = `Please analyze this workflow description and generate appropriate columns for a Kanban board:\n\n${description}`;
    
    // Make the API call to OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7
    });
    
    // Extract the response content
    const content = response.choices[0].message.content;
    
    if (!content) {
      throw new Error("OpenAI returned an empty response");
    }
    
    console.log(`OpenAI response received with length: ${content.length}`);
    
    // Parse the JSON response
    try {
      // Extract JSON from the response content (in case there's additional text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error("Could not find JSON in OpenAI response");
      }
      
      const jsonContent = jsonMatch[0];
      const workflowData = JSON.parse(jsonContent) as GenerateWorkflowResponse;
      
      // Validate the response structure
      if (!workflowData.boardName || !Array.isArray(workflowData.columns)) {
        throw new Error("Invalid response structure from OpenAI");
      }
      
      console.log(`Successfully generated workflow with ${workflowData.columns.length} columns`);
      
      return workflowData;
    } catch (parseError) {
      console.error("Error parsing OpenAI response:", parseError);
      console.error("Raw response:", content);
      throw new Error("Failed to parse OpenAI response");
    }
  } catch (error) {
    console.error("Error generating workflow columns:", error);
    throw error;
  }
}