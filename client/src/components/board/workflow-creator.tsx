import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Column, Board } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface WorkflowCreatorProps {
  onBoardCreated: (boardId: number) => void;
  onCancel: () => void;
}

export function WorkflowCreator({ onBoardCreated, onCancel }: WorkflowCreatorProps) {
  const [step, setStep] = useState<'description' | 'preview' | 'loading'>('description');
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [generatedColumns, setGeneratedColumns] = useState<{
    name: string;
    gptAssigned: boolean;
    gptName: string;
    gptInstructions: string;
  }[]>([]);
  const [boardName, setBoardName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  // Generate board with AI
  const handleGenerateWithAI = async () => {
    if (!workflowDescription.trim()) {
      toast({
        title: "Error",
        description: "Please describe your workflow",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Call the API to generate columns based on workflow description
      const response = await apiRequest("POST", "/api/generate-columns", {
        description: workflowDescription,
      });

      // Set generated columns and move to preview step
      setGeneratedColumns(response.columns);
      setBoardName(response.boardName || "My Workflow");
      setStep('preview');
    } catch (error) {
      console.error("Failed to generate columns:", error);
      toast({
        title: "Error",
        description: "Failed to generate columns from your description",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Create board from scratch (manual setup)
  const handleStartFromScratch = () => {
    // Initialize with empty columns
    setGeneratedColumns([
      { 
        name: "Backlog", 
        gptAssigned: false, 
        gptName: "", 
        gptInstructions: ""
      },
      {
        name: "Lane 1",
        gptAssigned: true,
        gptName: "AI Action #1",
        gptInstructions: "DO's - Example AI Prompt"
      },
      {
        name: "Lane 2",
        gptAssigned: true,
        gptName: "AI Action #2",
        gptInstructions: "DO's - Example AI Prompt"
      },
    ]);
    setBoardName("My Workflow");
    setStep('preview');
  };

  // Update column information
  const updateColumn = (index: number, data: Partial<typeof generatedColumns[0]>) => {
    const updatedColumns = [...generatedColumns];
    updatedColumns[index] = { ...updatedColumns[index], ...data };
    setGeneratedColumns(updatedColumns);
  };

  // Create the final board
  const handleCreateBoard = async () => {
    setIsCreating(true);
    setStep('loading');

    try {
      // First create the board
      const board = await apiRequest("POST", "/api/boards", {
        name: boardName.trim() || "My Workflow",
        userId: null,
      });

      if (!board || !board.id) {
        throw new Error("Failed to create board");
      }

      // Create each column
      for (let i = 0; i < generatedColumns.length; i++) {
        const col = generatedColumns[i];
        await apiRequest("POST", "/api/columns", {
          name: col.name,
          boardId: board.id,
          gptAssigned: col.gptAssigned,
          gptName: col.gptName,
          gptInstructions: col.gptInstructions,
          order: i,
        });
      }

      // Refresh boards data
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });

      toast({
        title: "Success",
        description: "Your workflow board has been created!",
      });

      // Navigate to the new board
      onBoardCreated(board.id);
    } catch (error) {
      console.error("Failed to create board:", error);
      toast({
        title: "Error",
        description: "Failed to create your workflow board",
        variant: "destructive",
      });
      setStep('preview');
    } finally {
      setIsCreating(false);
    }
  };

  // Go back to description step
  const handleGoBack = () => {
    setStep('description');
  };

  // Render the workflow description input step
  if (step === 'description') {
    return (
      <div className="max-w-md mx-auto p-4 flex flex-col items-center">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-xl text-center">What's your workflow?</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Describe your workflow here..."
              className="min-h-[140px]"
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.target.value)}
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button 
              onClick={handleGenerateWithAI} 
              className="w-full bg-purple-500 hover:bg-purple-600"
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate with AI'
              )}
            </Button>
            <Separator className="my-2" />
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleStartFromScratch}
            >
              Start From Scratch
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Render the board preview step
  if (step === 'preview') {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card className="w-full mb-4">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <Input
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                placeholder="Workflow Name"
                className="font-bold text-lg"
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {generatedColumns.map((column, index) => (
              <Card key={index} className="border p-4">
                <div className="flex justify-between items-center mb-2">
                  <Input
                    value={column.name}
                    onChange={(e) => updateColumn(index, { name: e.target.value })}
                    placeholder={`Lane ${index + 1} Name`}
                    className="font-medium"
                  />
                  <span className="text-xs text-gray-500">0</span>
                </div>
                {column.gptAssigned && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1 text-green-600">
                      <div className="w-4 h-4 rounded-full bg-green-500"></div>
                      <Input
                        value={column.gptName}
                        onChange={(e) => updateColumn(index, { gptName: e.target.value })}
                        placeholder="AI Action Name"
                        className="text-sm"
                      />
                    </div>
                    <Textarea
                      value={column.gptInstructions}
                      onChange={(e) => updateColumn(index, { gptInstructions: e.target.value })}
                      placeholder="AI Instructions"
                      className="text-sm min-h-[80px] mt-1"
                    />
                  </div>
                )}
              </Card>
            ))}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={handleGoBack}>
              Back
            </Button>
            <Button onClick={handleCreateBoard}>
              Create Board
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Render loading state
  return (
    <div className="max-w-md mx-auto p-4 flex flex-col items-center justify-center min-h-[300px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-center text-lg font-medium">Creating your workflow board...</p>
    </div>
  );
}