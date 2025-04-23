import { useState } from "react";
import { useLocation } from "wouter";
import { PageLayout } from "@/components/layout/page-layout";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, MoreVertical, ChevronDown, Edit, Sparkles, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [editingInstructions, setEditingInstructions] = useState<number | null>(null);
  const [menuOpenForIndex, setMenuOpenForIndex] = useState<number | null>(null);
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
  
  // Toggle card expansion
  const toggleCardExpansion = (index: number) => {
    if (expandedCard === index) {
      setExpandedCard(null);
    } else {
      setExpandedCard(index);
    }
  };
  
  // Toggle edit mode for instructions
  const toggleEditInstructions = (index: number) => {
    if (editingInstructions === index) {
      setEditingInstructions(null);
    } else {
      setEditingInstructions(index);
    }
  };
  
  // Add a new lane at the bottom
  const addNewLane = () => {
    const newColumn = {
      name: `Lane ${generatedColumns.length + 1}`,
      gptAssigned: false,
      gptName: "",
      gptInstructions: ""
    };
    setGeneratedColumns([...generatedColumns, newColumn]);
  };
  
  // Toggle AI assistant for a lane
  const toggleGptAssigned = (index: number) => {
    const updatedColumns = [...generatedColumns];
    if (!updatedColumns[index].gptAssigned) {
      updatedColumns[index] = { 
        ...updatedColumns[index], 
        gptAssigned: true,
        gptName: `AI Assistant ${index + 1}`,
        gptInstructions: "Help the user with their task. Provide guidance, answer questions, and offer suggestions."
      };
    } else {
      updatedColumns[index] = { 
        ...updatedColumns[index], 
        gptAssigned: false,
        gptName: "",
        gptInstructions: ""
      };
    }
    setGeneratedColumns(updatedColumns);
  };
  
  // Delete a lane
  const deleteLane = (index: number) => {
    // Ask for confirmation
    if (window.confirm(`Are you sure you want to delete the "${generatedColumns[index].name}" lane?`)) {
      const updatedColumns = [...generatedColumns];
      updatedColumns.splice(index, 1);
      setGeneratedColumns(updatedColumns);
      
      // Make sure to clear any expanded/editing state if the deleted lane had any
      if (expandedCard === index) {
        setExpandedCard(null);
      }
      if (editingInstructions === index) {
        setEditingInstructions(null);
      }
      if (menuOpenForIndex === index) {
        setMenuOpenForIndex(null);
      }
      
      toast({
        title: "Lane deleted",
        description: "The lane has been removed from your workflow."
      });
    }
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
        // Based on the mockup:
        // First lane uses Mint (green)
        // Second lane uses Sky (blue)
        // Third lane uses Peach (orange)
        const colors = ["Mint", "Sky", "Peach", "Lavender", "Aqua"];
        return colors[index % colors.length];
      };
      
      // Helper function to get style classes based on color name
      const getColorStyles = (colorName: string) => {
        const colors: Record<string, {bg: string, text: string, border: string, cardBg: string}> = {
          "Peach": { bg: "bg-[#FEE9D7]", text: "text-[#E25B3D]", border: "border-[#F7C9B0]", cardBg: "bg-[#FFF5ED]" },
          "Sky": { bg: "bg-[#E1F2FE]", text: "text-[#2E7EC9]", border: "border-[#B7DCF7]", cardBg: "bg-[#EDF7FE]" }, 
          "Lavender": { bg: "bg-[#F6E6FF]", text: "text-[#C235D1]", border: "border-[#E9CEFB]", cardBg: "bg-[#FAEDFF]" },
          "Mint": { bg: "bg-[#DDFFE7]", text: "text-[#1A9E5E]", border: "border-[#C1EDD4]", cardBg: "bg-[#EDFFF3]" },
          "Aqua": { bg: "bg-[#E0F9FF]", text: "text-[#3992B0]", border: "border-[#C3E8F4]", cardBg: "bg-[#EDFCFF]" }
        };
        
        return colors[colorName] || colors["Peach"];
      };
      
      return (
        <div className="max-w-md mx-auto p-4">
          <div className="bg-white rounded-xl border shadow-sm p-4 mb-4">
            <h2 className="text-center font-bold text-2xl mb-6">{boardName || "Workflow Name #1"}</h2>
            
            <div className="space-y-4">
              {generatedColumns.map((column, index) => (
                <div key={index} className="bg-white rounded-lg border shadow-sm">
                  <div className="p-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <Input
                          value={column.name}
                          onChange={(e) => updateColumn(index, { name: e.target.value })}
                          placeholder={`LANE ${index + 1} NAME`}
                          className="font-bold uppercase text-xl w-auto border-none p-0 focus-visible:ring-0"
                        />
                      </div>
                      <DropdownMenu
                        open={menuOpenForIndex === index}
                        onOpenChange={(open) => {
                          setMenuOpenForIndex(open ? index : null);
                        }}
                      >
                        <DropdownMenuTrigger asChild>
                          <div 
                            className="text-muted-foreground cursor-pointer"
                            title="Options"
                          >
                            <MoreVertical className="h-5 w-5" />
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Lane Options</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => toggleGptAssigned(index)}>
                            <Sparkles className="mr-2 h-4 w-4" />
                            {column.gptAssigned ? "Remove AI Assistant" : "Add AI Assistant"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteLane(index)}>
                            <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                            Delete Lane
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    {column.gptAssigned && (
                      <div className={`mt-4 p-4 rounded-lg ${getColorStyles(getColorForIndex(index)).cardBg}`}>
                        <div className="flex justify-between">
                          <div className={`flex items-center gap-2 ${getColorStyles(getColorForIndex(index)).text}`}>
                            <Sparkles className="h-5 w-5" />
                            <Input
                              value={column.gptName}
                              onChange={(e) => updateColumn(index, { gptName: e.target.value })}
                              placeholder={`AI Action #${index + 1}`}
                              className={`font-medium text-lg border-none p-0 ${getColorStyles(getColorForIndex(index)).text} focus-visible:ring-0 bg-transparent`}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <div 
                              className="cursor-pointer" 
                              onClick={() => toggleCardExpansion(index)}
                              title="Toggle instructions"
                            >
                              {expandedCard === index ? (
                                <ChevronDown className={`h-5 w-5 ${getColorStyles(getColorForIndex(index)).text} rotate-180 transition-transform`} />
                              ) : (
                                <ChevronDown className={`h-5 w-5 ${getColorStyles(getColorForIndex(index)).text} transition-transform`} />
                              )}
                            </div>
                            <div 
                              className="cursor-pointer" 
                              onClick={() => toggleEditInstructions(index)}
                              title="Edit instructions"
                            >
                              <Edit className={`h-5 w-5 ${getColorStyles(getColorForIndex(index)).text}`} />
                            </div>
                          </div>
                        </div>
                        
                        {/* Show only one of these two blocks depending on the expandedCard state */}
                        {expandedCard === index ? (
                          <div className="mt-2 pl-7">
                            {editingInstructions === index ? (
                              <Textarea 
                                value={column.gptInstructions}
                                onChange={(e) => updateColumn(index, { gptInstructions: e.target.value })}
                                placeholder="Enter instructions for AI assistant"
                                className="min-h-[100px] text-sm"
                                onBlur={() => setEditingInstructions(null)}
                                autoFocus
                              />
                            ) : (
                              <div className="text-gray-500 text-sm">
                                {column.gptInstructions || "No instructions provided. Click the edit button to add instructions."}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-gray-500 mt-1 pl-6">
                            {editingInstructions === index ? (
                              <Textarea 
                                value={column.gptInstructions}
                                onChange={(e) => updateColumn(index, { gptInstructions: e.target.value })}
                                placeholder="Enter instructions for AI assistant"
                                className="min-h-[100px] text-sm"
                                onBlur={() => setEditingInstructions(null)}
                                autoFocus
                              />
                            ) : (
                              <div className="line-clamp-1">
                                {column.gptInstructions || "Click edit to add instructions"}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Add New Lane Button */}
              <div className="flex justify-center mt-4">
                <Button 
                  variant="outline" 
                  onClick={addNewLane}
                  className="text-gray-500 border-dashed border-2 w-full py-6 hover:bg-gray-50"
                >
                  + Add New Lane
                </Button>
              </div>
            </div>
            
            <div className="mt-6 flex justify-center">
              <Button 
                onClick={handleCreateBoard}
                className="bg-green-400 hover:bg-green-500 text-white font-semibold rounded-full px-8 py-2 w-full max-w-xs"
              >
                Create Board
              </Button>
            </div>
          </div>
            
          <div className="flex justify-start">
            <Button variant="ghost" onClick={handleGoBack} className="text-gray-500">
              Back
            </Button>
          </div>
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