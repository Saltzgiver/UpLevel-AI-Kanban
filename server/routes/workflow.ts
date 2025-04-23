import { Express } from "express";
import { generateWorkflowColumns } from "../workflowGenerator";

export function registerWorkflowRoutes(app: Express): void {
  // Workflow creator endpoint - Generate columns from a workflow description
  app.post("/api/generate-columns", async (req, res) => {
    try {
      const { description } = req.body;
      
      if (!description || typeof description !== 'string') {
        return res.status(400).json({ message: "Workflow description is required" });
      }
      
      console.log(`Generating columns from workflow description: "${description.substring(0, 50)}..."`);
      
      // Generate columns using OpenAI
      const workflowData = await generateWorkflowColumns(description);
      
      return res.json(workflowData);
    } catch (error) {
      console.error("Error generating workflow columns:", error);
      return res.status(500).json({ 
        message: "Error generating workflow columns",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}