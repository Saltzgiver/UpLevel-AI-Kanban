import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Column } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check } from "lucide-react";

interface AssignGPTModalProps {
  column: Column;
  isOpen: boolean;
  onClose: () => void;
}

// Define color palette
const colorPalette = [
  { name: "Peach", bg: "bg-[#FEE9D7]", text: "text-[#E25B3D]", border: "border-[#F7C9B0]" },
  { name: "Sky", bg: "bg-[#E1F2FE]", text: "text-[#2E7EC9]", border: "border-[#B7DCF7]" }, 
  { name: "Lavender", bg: "bg-[#F6E6FF]", text: "text-[#C235D1]", border: "border-[#E9CEFB]" },
  { name: "Mint", bg: "bg-[#DDFFE7]", text: "text-[#1A9E5E]", border: "border-[#C1EDD4]" },
  { name: "Aqua", bg: "bg-[#E0F9FF]", text: "text-[#3992B0]", border: "border-[#C3E8F4]" }
];

// Function to automatically assign a color based on existing columns
const getNextColorInRotation = async (): Promise<string> => {
  try {
    // Get all existing columns
    const response = await fetch('/api/boards');
    const boards = await response.json();
    
    // Extract all columns with GPT assigned
    const gptColumns = boards.flatMap((board: any) => 
      board.columns.filter((col: any) => col.gptAssigned && col.gptColor)
    );
    
    // Get all colors currently in use
    const usedColors = gptColumns.map((col: any) => col.gptColor);
    
    // Find first unused color, or use least used color if all are in use
    const colorCounts: Record<string, number> = {};
    const colorNames = colorPalette.map(color => color.name);
    
    // Initialize counts
    colorNames.forEach(name => {
      colorCounts[name] = 0;
    });
    
    // Count usage of each color
    usedColors.forEach((color: string) => {
      if (color in colorCounts) {
        colorCounts[color]++;
      }
    });
    
    // Find unused or least used color
    const unusedColors = colorNames.filter(name => colorCounts[name] === 0);
    
    if (unusedColors.length > 0) {
      // Return the first unused color
      return unusedColors[0];
    } else {
      // All colors are used, find the least used one
      const sortedColors = Object.entries(colorCounts)
        .sort(([, countA], [, countB]) => countA - countB);
      
      return sortedColors[0][0]; // Return the name of the least used color
    }
  } catch (error) {
    console.error('Error fetching colors:', error);
    return "Peach"; // Default if there's an error
  }
};

export function AssignGPTModal({ column, isOpen, onClose }: AssignGPTModalProps) {
  const [gptName, setGptName] = useState<string>(column.gptName || "GPT Assistant");
  const [apiKey, setApiKey] = useState<string>(column.apiKey || "");
  const [instructions, setInstructions] = useState<string>(column.gptInstructions || "");
  const [gptColor, setGptColor] = useState<string>(column.gptColor || "");
  const [autoTrigger, setAutoTrigger] = useState<boolean>(column.autoTrigger !== false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { toast } = useToast();
  
  // Get the next color automatically when the modal opens for a new GPT configuration
  useEffect(() => {
    if (isOpen && !column.gptAssigned) {
      const assignNextColor = async () => {
        const nextColor = await getNextColorInRotation();
        setGptColor(nextColor);
      };
      assignNextColor();
    } else if (isOpen && column.gptColor) {
      // If editing existing column, use its current color
      setGptColor(column.gptColor);
    }
  }, [isOpen, column.gptAssigned, column.gptColor]);

  const handleSubmit = async () => {
    if (!instructions.trim()) {
      toast({
        title: "Error",
        description: "Please enter custom instructions for the GPT",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await apiRequest("PATCH", `/api/columns/${column.id}/assign-gpt`, {
        gptAssigned: true,
        gptName,
        apiKey,
        gptInstructions: instructions,
        gptColor,
        autoTrigger
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      
      toast({
        title: "Success",
        description: `GPT assigned to ${column.name}`,
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to assign GPT",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set GPT Prompt for Column</DialogTitle>
          <DialogDescription>Cards in this column will be processed with the instructions you provide</DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="column-name">Column</Label>
            <div className="px-3 py-2 bg-muted rounded border text-sm">
              {column.name}
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="gpt-name">Custom Name (Optional)</Label>
            <Input 
              id="gpt-name" 
              placeholder="GPT Assistant" 
              value={gptName}
              onChange={(e) => setGptName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              This name will appear in chats and outputs
            </p>
          </div>
          
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="api-key">API Key (Optional)</Label>
              <Button variant="link" className="h-auto p-0" onClick={() => setApiKey("")}>
                Use default
              </Button>
            </div>
            <Input 
              id="api-key" 
              type="password" 
              placeholder="sk-..." 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use your default OpenAI API key
            </p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="instructions">Custom Instructions (Required)</Label>
            <Textarea 
              id="instructions" 
              placeholder="Write detailed instructions for how GPT should process cards in this column..." 
              rows={5}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Example: "Generate a poem based on the card title and description"
            </p>
          </div>
          
          <div className="grid gap-2">
            <Label>GPT Color</Label>
            <div className="flex flex-wrap gap-2">
              {colorPalette.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  className={`relative ${color.bg} ${color.text} ${color.border} flex items-center justify-center px-5 py-3 rounded-md border hover:opacity-90 transition-opacity ${
                    gptColor === color.name ? 'ring-2 ring-offset-2 ring-primary' : ''
                  }`}
                  onClick={() => setGptColor(color.name)}
                >
                  <span>Text</span>
                  {gptColor === color.name && (
                    <div className="absolute top-1 right-1">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              This color will be used to identify the AI assistant in chat
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="auto-trigger" 
              checked={autoTrigger}
              onCheckedChange={(checked) => setAutoTrigger(!!checked)}
            />
            <Label htmlFor="auto-trigger" className="text-sm">
              Auto-process cards when moved to this column
            </Label>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? "Saving..." : "Save Configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
