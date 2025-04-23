import { useState } from "react";
import { useLocation } from "wouter";
import { PageLayout } from "@/components/layout/page-layout";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

/**
 * Type for the API response from the generate-columns endpoint
 */
interface GenerateColumnsResponse {
  boardName: string;
  columns: {
    name: string;
    gptAssigned: boolean;
    gptName: string;
    gptInstructions: string;
  }[];
}

/**
 * Type for the API response from the boards endpoint
 */
interface BoardResponse {
  id: number;
  name: string;
  userId: number | null;
  createdAt: string;
}

/**
 * Page for creating a board with a guided workflow
 */
export default function CreateWorkflowPage() {
  const [_, setLocation] = useLocation();
  const [step, setStep] = useState<'description' | 'preview' | 'loading'>('description');
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [boardName, setBoardName] = useState("");
  const [generatedColumns, setGeneratedColumns] = useState<GenerateColumnsResponse['columns']>([]);
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
      const response = await apiRequest<GenerateColumnsResponse>("POST", "/api/generate-columns", {
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

  // Create board from scratch (create directly with default columns)
  const handleStartFromScratch = async () => {
    setIsCreating(true);
    setStep('loading');
    
    try {
      // Create a basic board with default columns
      console.log("Creating a basic board from scratch");
      
      // Use fetch directly with a longer timeout to avoid timeouts
      const boardResponse = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "My Board",
          userId: null,
        }),
      });
      
      if (!boardResponse.ok) {
        const errorText = await boardResponse.text();
        throw new Error(`Server error: ${boardResponse.status} - ${errorText}`);
      }
      
      const board = await boardResponse.json();
      console.log("Board created successfully:", board);

      if (!board || !board.id) {
        throw new Error("Failed to create board - no ID returned");
      }
      
      // Store the board ID in localStorage so the home component will select it
      localStorage.setItem('activeBoardId', board.id.toString());
      console.log("Set active board ID in localStorage:", board.id);

      // Create three basic columns
      console.log("Creating basic columns for board ID:", board.id);
      const defaultColumns = [
        { 
          name: "Backlog", 
          gptAssigned: false, 
          gptName: "", 
          gptInstructions: "",
          order: 0 
        },
        {
          name: "In Progress",
          gptAssigned: true,
          gptName: "Assistant",
          gptInstructions: "Help the user with their task in progress. Provide guidance, answer questions, and offer suggestions to move the task forward.",
          order: 1
        },
        {
          name: "Done",
          gptAssigned: false,
          gptName: "",
          gptInstructions: "",
          order: 2
        }
      ];
      
      for (let i = 0; i < defaultColumns.length; i++) {
        const col = defaultColumns[i];
        console.log(`Creating column ${i+1}/${defaultColumns.length}: ${col.name}`);
        
        const columnResponse = await fetch("/api/columns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: col.name,
            boardId: board.id,
            gptAssigned: col.gptAssigned,
            gptName: col.gptName,
            gptInstructions: col.gptInstructions,
            order: col.order,
          }),
        });
        
        if (!columnResponse.ok) {
          const errorText = await columnResponse.text();
          console.error(`Failed to create column ${i+1}: ${errorText}`);
          // Continue creating other columns even if one fails
        } else {
          console.log(`Column ${i+1} created successfully`);
        }
      }

      // Refresh boards data
      console.log("Refreshing board data");
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });

      toast({
        title: "Success",
        description: "Your board has been created!",
      });

      // Navigate to the board page
      console.log("Redirecting to home page");
      window.location.href = "/";
      
    } catch (error: any) {
      console.error("Failed to create board:", error);
      toast({
        title: "Error",
        description: `Failed to create your board: ${error?.message || "Unknown error"}`,
        variant: "destructive",
      });
      setStep('description');
    } finally {
      setIsCreating(false);
    }
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
      console.log("Creating board with name:", boardName.trim() || "My Workflow");
      
      // Use fetch directly with a longer timeout to avoid timeouts
      const boardResponse = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: boardName.trim() || "My Workflow",
          userId: null,
        }),
      });
      
      if (!boardResponse.ok) {
        const errorText = await boardResponse.text();
        throw new Error(`Server error: ${boardResponse.status} - ${errorText}`);
      }
      
      const board = await boardResponse.json();
      console.log("Board created successfully:", board);

      if (!board || !board.id) {
        throw new Error("Failed to create board - no ID returned");
      }
      
      // Store the board ID in localStorage so the home component will select it
      localStorage.setItem('activeBoardId', board.id.toString());
      console.log("Set active board ID in localStorage:", board.id);

      // Create each column
      console.log("Creating columns for board ID:", board.id);
      for (let i = 0; i < generatedColumns.length; i++) {
        const col = generatedColumns[i];
        console.log(`Creating column ${i+1}/${generatedColumns.length}: ${col.name}`);
        
        const columnResponse = await fetch("/api/columns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: col.name,
            boardId: board.id,
            gptAssigned: col.gptAssigned,
            gptName: col.gptName,
            gptInstructions: col.gptInstructions,
            order: i,
          }),
        });
        
        if (!columnResponse.ok) {
          const errorText = await columnResponse.text();
          console.error(`Failed to create column ${i+1}: ${errorText}`);
          // Continue creating other columns even if one fails
        } else {
          console.log(`Column ${i+1} created successfully`);
        }
      }

      // Refresh boards data
      console.log("Refreshing board data");
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });

      toast({
        title: "Success",
        description: "Your workflow board has been created!",
      });

      // Navigate to the board page
      console.log("Redirecting to home page");
      
      // We need a more forceful navigation to ensure a fresh load of the home component
      window.location.href = "/";
      
      // The setLocation is a fallback, but we primarily want the full page reload
      // setLocation("/");
      
      // After the navigation, the home component will show the latest board
    } catch (error: any) {
      console.error("Failed to create board:", error);
      toast({
        title: "Error",
        description: `Failed to create your workflow board: ${error?.message || "Unknown error"}`,
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

  // Go back to the home page
  const handleCancel = () => {
    // Use window.location for a full page refresh to ensure proper state loading
    window.location.href = "/";
  };

  // Render the appropriate content based on the current step
  const renderStepContent = () => {
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

    if (step === 'preview') {
      // Helper function to get color style based on index (cycling through colors)
      const getColorForIndex = (index: number) => {
        const colors = ["Peach", "Sky", "Lavender", "Mint", "Aqua"];
        return colors[index % colors.length];
      };
      
      // Helper function to get style classes based on color name
      const getColorStyles = (colorName: string) => {
        const colors: Record<string, {bg: string, text: string, border: string}> = {
          "Peach": { bg: "bg-[#FEE9D7]", text: "text-[#E25B3D]", border: "border-[#F7C9B0]" },
          "Sky": { bg: "bg-[#E1F2FE]", text: "text-[#2E7EC9]", border: "border-[#B7DCF7]" }, 
          "Lavender": { bg: "bg-[#F6E6FF]", text: "text-[#C235D1]", border: "border-[#E9CEFB]" },
          "Mint": { bg: "bg-[#DDFFE7]", text: "text-[#1A9E5E]", border: "border-[#C1EDD4]" },
          "Aqua": { bg: "bg-[#E0F9FF]", text: "text-[#3992B0]", border: "border-[#C3E8F4]" }
        };
        
        return colors[colorName] || colors["Peach"];
      };
      
      return (
        <div className="max-w-5xl mx-auto p-4">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {generatedColumns.map((column, index) => (
                  <Card key={index} className="border p-4">
                    <div className="flex justify-between items-center mb-2">
                      <Input
                        value={column.name}
                        onChange={(e) => updateColumn(index, { name: e.target.value })}
                        placeholder={`LANE ${index + 1} NAME`}
                        className="font-medium uppercase text-sm tracking-wide"
                      />
                      <span 
                        className="text-xs text-gray-500 flex items-center cursor-default" 
                        title="Cards will be added here after the board is created"
                      >
                        <div className="h-4 w-4 text-gray-400 mr-1">📄</div>
                        0
                      </span>
                    </div>
                    {column.gptAssigned && (
                      <div className="mt-2 p-3 rounded-md" style={{backgroundColor: column.gptName ? `rgba(${index * 40}, ${255 - index * 20}, ${150 + index * 20}, 0.1)` : 'transparent'}}>
                        <div className={`flex items-center gap-2 mb-1 ${getColorStyles(getColorForIndex(index)).text}`}>
                          <div className={`w-4 h-4 rounded-full ${getColorStyles(getColorForIndex(index)).bg}`}></div>
                          <Input
                            value={column.gptName}
                            onChange={(e) => updateColumn(index, { gptName: e.target.value })}
                            placeholder="AI Action #1"
                            className="text-sm"
                          />
                        </div>
                        <div className="text-xs text-gray-500 mb-1">DO'S - Example AI Prompt</div>
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
              </div>
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

    // Loading state
    return (
      <div className="max-w-md mx-auto p-4 flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-center text-lg font-medium">Creating your workflow board...</p>
      </div>
    );
  };

  return (
    <PageLayout>
      <div className="container py-8">
        <div className="mb-6 flex items-center">
          <Button 
            variant="ghost" 
            className="mr-4"
            onClick={handleCancel}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Boards
          </Button>
          <h1 className="text-2xl font-bold">Create Workflow Board</h1>
        </div>
        
        {renderStepContent()}
      </div>
    </PageLayout>
  );
}