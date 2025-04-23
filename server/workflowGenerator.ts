import OpenAI from "openai";
import { getOpenAIClient } from "./openai";

interface GeneratedColumn {
  name: string;
  gptAssigned: boolean;
  gptName: string;
  gptInstructions: string;
}

interface GenerateWorkflowResponse {
  boardName: string;
  columns: GeneratedColumn[];
}

/**
 * Generate kanban board columns from a workflow description using OpenAI
 */
export async function generateWorkflowColumns(description: string): Promise<GenerateWorkflowResponse> {
  try {
    // Get OpenAI client using environment API key
    const openai = getOpenAIClient();
    
    // Create the system prompt
    const systemPrompt = `
      You are an expert business process analyst. Your task is to analyze a user's workflow description
      and convert it into an optimal kanban board structure with AI-powered lanes.
      
      For each step in the workflow, create a lane with:
      1. A clear, concise lane name
      2. An AI assistant name relevant to that step's function
      3. Clear AI instructions formatted as "DO's - [detailed prompt for the AI]"
      
      Additionally, always include a "Backlog" lane as the first lane, which will not have AI assigned.
      
      Format your response as valid JSON with the following structure:
      {
        "boardName": "A descriptive name for the board based on the workflow",
        "columns": [
          {
            "name": "Backlog",
            "gptAssigned": false,
            "gptName": "",
            "gptInstructions": ""
          },
          {
            "name": "Lane Name",
            "gptAssigned": true,
            "gptName": "AI Name",
            "gptInstructions": "DO's - Detailed instructions for this step"
          },
          ...more lanes as needed (typically 3-5 lanes total including Backlog)
        ]
      }
    `;

    // Prepare user message with the workflow description
    const userMessage = `Please create a kanban board structure from the following workflow description: "${description}"`;
    
    // Make the API call to OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Use the latest model
      temperature: 0.7, // Add some creativity while maintaining relevance
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userMessage
        }
      ]
    });

    // Get the response content
    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Parse the JSON response
    const workflowData = JSON.parse(content) as GenerateWorkflowResponse;
    
    // Ensure expected structure
    if (!workflowData.columns || !Array.isArray(workflowData.columns)) {
      throw new Error("Invalid response structure from OpenAI");
    }

    // Ensure there's a backlog column
    if (!workflowData.columns.some(col => col.name === "Backlog" && !col.gptAssigned)) {
      workflowData.columns.unshift({
        name: "Backlog",
        gptAssigned: false,
        gptName: "",
        gptInstructions: ""
      });
    }

    return workflowData;
  } catch (error) {
    console.error("Error generating workflow columns:", error);
    
    // Return a default structure if there's an error
    return {
      boardName: "My Workflow",
      columns: [
        {
          name: "Backlog",
          gptAssigned: false,
          gptName: "",
          gptInstructions: ""
        },
        {
          name: "Planning",
          gptAssigned: true,
          gptName: "Planner",
          gptInstructions: "DO's - Help organize and structure tasks. Break down complex tasks into manageable steps."
        },
        {
          name: "In Progress",
          gptAssigned: true,
          gptName: "Assistant",
          gptInstructions: "DO's - Provide guidance and suggestions for completing tasks effectively."
        },
        {
          name: "Review",
          gptAssigned: true,
          gptName: "Reviewer",
          gptInstructions: "DO's - Analyze completed work for quality and suggest improvements."
        }
      ]
    };
  }
}