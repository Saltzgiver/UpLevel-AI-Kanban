import { useState } from "react";
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

interface AssignGPTModalProps {
  column: Column;
  isOpen: boolean;
  onClose: () => void;
}

export function AssignGPTModal({ column, isOpen, onClose }: AssignGPTModalProps) {
  const [gptName, setGptName] = useState<string>(column.gptName || "GPT Assistant");
  const [apiKey, setApiKey] = useState<string>(column.apiKey || "");
  const [instructions, setInstructions] = useState<string>(column.gptInstructions || "");
  const [autoTrigger, setAutoTrigger] = useState<boolean>(column.autoTrigger !== false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { toast } = useToast();

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
