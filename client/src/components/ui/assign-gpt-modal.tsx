import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Column } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AssignGPTModalProps {
  column: Column;
  isOpen: boolean;
  onClose: () => void;
}

const GPT_OPTIONS = [
  { value: "brainstorming", label: "Brainstorming GPT" },
  { value: "content-writer", label: "Content Writer GPT" },
  { value: "design-assistant", label: "Design Assistant GPT" },
  { value: "code-reviewer", label: "Code Reviewer GPT" },
  { value: "market-researcher", label: "Market Researcher GPT" }
];

export function AssignGPTModal({ column, isOpen, onClose }: AssignGPTModalProps) {
  const [gptName, setGptName] = useState<string>(column.gptName || "");
  const [apiKey, setApiKey] = useState<string>(column.apiKey || "");
  const [instructions, setInstructions] = useState<string>(column.gptInstructions || "");
  const [autoTrigger, setAutoTrigger] = useState<boolean>(column.autoTrigger !== false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { toast } = useToast();

  const handleSelectGPT = (value: string) => {
    const selected = GPT_OPTIONS.find(option => option.value === value);
    if (selected) {
      setGptName(selected.label);
    }
  };

  const handleSubmit = async () => {
    if (!gptName) {
      toast({
        title: "Error",
        description: "Please select a GPT",
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
        autoTrigger
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      
      toast({
        title: "Success",
        description: `${gptName} assigned to ${column.name}`,
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
          <DialogTitle>Assign GPT to Column</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="column-name">Column</Label>
            <div className="px-3 py-2 bg-muted rounded border text-sm">
              {column.name}
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="gpt-select">Select GPT</Label>
            <Select onValueChange={handleSelectGPT}>
              <SelectTrigger>
                <SelectValue placeholder="Select a GPT..." />
              </SelectTrigger>
              <SelectContent>
                {GPT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="api-key">Custom API Key (Optional)</Label>
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
              Leave blank to use your default API key
            </p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="instructions">Custom Instructions</Label>
            <Textarea 
              id="instructions" 
              placeholder="Enter any specific instructions for this GPT when processing cards..." 
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="auto-trigger" 
              checked={autoTrigger}
              onCheckedChange={(checked) => setAutoTrigger(checked as boolean)}
            />
            <Label htmlFor="auto-trigger" className="text-sm">
              Auto-trigger when cards are moved
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
            {isSubmitting ? "Assigning..." : "Assign GPT"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
