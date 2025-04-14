import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Column } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Sparkles, AlertCircle, Diff, Loader2, ArrowRight, ThumbsUp, ThumbsDown } from "lucide-react";
import { useModalContext } from "@/contexts/ModalContext";

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
  const [instructions, setInstructions] = useState<string>(column.gptInstructions || "");
  const [gptColor, setGptColor] = useState<string>(column.gptColor || "");
  const [autoTrigger, setAutoTrigger] = useState<boolean>(column.autoTrigger !== false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [suggestion, setSuggestion] = useState<{ rationale: string; suggestedInstructions: string } | null>(null);
  const [showingSuggestion, setShowingSuggestion] = useState<boolean>(false);
  const { toast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  const { modalState } = useModalContext();
  
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
  
  // Reset form state when modal opens and fetch suggestion if in suggestion mode
  useEffect(() => {
    if (!isOpen) return;
    
    setGptName(column.gptName || "GPT Assistant");
    setInstructions(column.gptInstructions || "");
    setAutoTrigger(column.autoTrigger !== false);
    
    // Check if we're in suggestion mode and fetch suggestion
    if (modalState.isSuggestionMode && modalState.columnId === column.id && modalState.cardId) {
      const fetchSuggestion = async () => {
        try {
          setIsSubmitting(true);
          const response = await apiRequest(
            "GET", 
            `/api/columns/${column.id}/prompt-suggestion/${modalState.cardId}`
          );
          
          // Type assertion for the response
          interface SuggestionResponse {
            suggestion?: { rationale: string; suggestedInstructions: string }
          }
          
          const data = response as SuggestionResponse;
          
          if (data && data.suggestion) {
            setSuggestion(data.suggestion);
            setShowingSuggestion(true);
          }
        } catch (error) {
          console.error("Failed to fetch suggestion:", error);
          toast({
            title: "Error",
            description: "Failed to load suggestion",
            variant: "destructive"
          });
        } finally {
          setIsSubmitting(false);
        }
      };
      
      fetchSuggestion();
    } else {
      // Reset suggestion state when not in suggestion mode
      setSuggestion(null);
      setShowingSuggestion(false);
    }
  }, [isOpen, column, modalState, toast]);

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

  // useEffect for click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Additional handlers for suggestion mode
  const handleApplySuggestion = () => {
    if (suggestion && suggestion.suggestedInstructions) {
      // Update the instructions with the suggestion
      setInstructions(suggestion.suggestedInstructions);
      
      // Hide the suggestion UI
      setShowingSuggestion(false);
      
      // Show a toast notification
      toast({
        title: "Suggestion Applied",
        description: "The suggested instructions have been applied. Review and save to confirm."
      });
      
      // Remove suggestion from UI but keep modal open for review/editing
      setSuggestion(null);
      
      // Also clear suggestion from server based on whether we're in card-specific mode
      if (modalState.columnId) {
        const endpoint = modalState.cardId 
          ? `/api/columns/${modalState.columnId}/prompt-suggestion/accept/${modalState.cardId}`
          : `/api/columns/${modalState.columnId}/prompt-suggestion/accept`;
        
        apiRequest("POST", endpoint, {})
          .catch(error => {
            console.error("Failed to accept suggestion:", error);
          });
      }
    }
  };
  
  const handleDismissSuggestion = () => {
    // Close the modal
    onClose();
    
    // Clear suggestion from server based on whether we're in card-specific mode
    if (modalState.columnId) {
      const endpoint = modalState.cardId 
        ? `/api/columns/${modalState.columnId}/prompt-suggestion/reject/${modalState.cardId}`
        : `/api/columns/${modalState.columnId}/prompt-suggestion/reject`;
      
      apiRequest("POST", endpoint, {})
        .catch(error => {
          console.error("Failed to reject suggestion:", error);
        });
    }
    
    // Show toast to confirm
    toast({
      title: "Suggestion Rejected",
      description: "The prompt suggestion has been dismissed."
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 overflow-hidden">
      <div 
        ref={modalRef}
        className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <div className="flex-1 flex items-center">
            <div className="flex items-center gap-2">
              {modalState.isSuggestionMode ? (
                <AlertCircle className="h-5 w-5 text-orange-500" />
              ) : (
                <Sparkles className="h-5 w-5 text-primary" />
              )}
              <h2 className="text-xl font-medium">
                {modalState.isSuggestionMode ? "Review Prompt Suggestion" : "Configure AI Assistant"}
              </h2>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full flex-shrink-0" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Column name display */}
        <div className="px-6 pt-4 pb-2 flex items-center">
          <Badge variant="outline" className="text-sm py-1 bg-gray-50">
            {column.name}
          </Badge>
          
          {modalState.isSuggestionMode && (
            <Badge variant="outline" className="text-sm ml-2 py-1 bg-amber-50 text-amber-700 border-amber-200">
              Suggestion Available
            </Badge>
          )}
        </div>
        
        {/* Suggestion explanation if in suggestion mode */}
        {modalState.isSuggestionMode && suggestion && (
          <div className="px-6 py-3 bg-amber-50 border-y border-amber-100">
            <div className="flex items-start mb-2">
              <Diff className="h-4 w-4 text-amber-600 mr-2 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                The system has analyzed past interactions with this column and suggests improvements to the prompt.
              </p>
            </div>
            
            <div className="bg-white border border-amber-200 rounded-md p-3 mb-3">
              <h3 className="text-sm font-medium text-amber-800 mb-2">Suggestion Rationale:</h3>
              <p className="text-sm text-gray-700">{suggestion.rationale}</p>
            </div>
          </div>
        )}
        
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          <div className="space-y-5">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="gpt-name" className="text-sm font-medium">Assistant Name</Label>
              <Input 
                id="gpt-name" 
                placeholder="GPT Assistant" 
                value={gptName}
                onChange={(e) => setGptName(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                This name will appear in chats and outputs
              </p>
            </div>
            
            {/* Instructions */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="instructions" className="text-sm font-medium">Instructions <span className="text-red-500">*</span></Label>
                
                {modalState.isSuggestionMode && suggestion && (
                  <Badge
                    variant="outline"
                    className="text-xs py-0.5 px-2 bg-amber-50 text-amber-700 border-amber-200 cursor-pointer hover:bg-amber-100"
                    onClick={() => setShowingSuggestion(!showingSuggestion)}
                  >
                    {showingSuggestion ? "Hide Suggestion" : "Show Suggestion"}
                  </Badge>
                )}
              </div>
              
              {/* Side-by-Side Prompt Suggestion View */}
              {modalState.isSuggestionMode && suggestion && showingSuggestion ? (
                <div className="mb-4">
                  <div className="mb-2">
                    <h3 className="text-sm font-medium mb-2">Compare Instructions</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Left side: Current Instructions */}
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-gray-500">Current Instructions</Label>
                        <div className="border border-gray-200 rounded-md bg-gray-50 p-3">
                          <Textarea
                            placeholder="No current instructions"
                            rows={6}
                            value={column.gptInstructions || ""}
                            readOnly
                            className="w-full resize-none border-0 bg-transparent p-0 focus-visible:ring-0 text-sm"
                          />
                        </div>
                      </div>
                      
                      {/* Right side: Suggested Instructions */}
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-amber-600">Suggested Instructions</Label>
                        <div className="border border-amber-200 rounded-md bg-amber-50 p-3">
                          <Textarea
                            placeholder="Suggested instructions..."
                            rows={6}
                            value={suggestion.suggestedInstructions}
                            readOnly
                            className="w-full resize-none border-0 bg-transparent p-0 focus-visible:ring-0 text-sm text-amber-900"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-gray-600 hover:bg-gray-100"
                        onClick={handleDismissSuggestion}
                      >
                        <ThumbsDown className="mr-2 h-4 w-4" />
                        Reject Suggestion
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                        onClick={handleApplySuggestion}
                      >
                        <ThumbsUp className="mr-2 h-4 w-4" />
                        Use Suggestion
                      </Button>
                    </div>
                  </div>
                  <Separator className="my-4" />
                </div>
              ) : null}
              
              {/* Current instructions editing textarea */}
              <div className="space-y-1">
                {modalState.isSuggestionMode && suggestion && showingSuggestion && (
                  <Label htmlFor="instructions" className="text-sm font-medium">
                    Edit Final Instructions <span className="text-red-500">*</span>
                  </Label>
                )}
                <Textarea 
                  id="instructions" 
                  placeholder="Write detailed instructions for how the AI should process cards in this column..." 
                  rows={4}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full resize-none"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Example: "Generate a poem based on the card title and description"
              </p>
            </div>
            
            {/* Color Selection - much smaller now */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Assistant Color</Label>
              <div className="flex gap-2">
                {colorPalette.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    className={`relative ${color.bg} ${color.text} ${color.border} h-8 w-8 flex-shrink-0 rounded-full border hover:opacity-90 transition-opacity ${
                      gptColor === color.name ? 'ring-2 ring-offset-1 ring-primary' : ''
                    }`}
                    onClick={() => setGptColor(color.name)}
                    title={color.name}
                  >
                    {gptColor === color.name && (
                      <Check className="h-4 w-4 m-auto" />
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Choose a color to identify the AI assistant in chats
              </p>
            </div>
            
            {/* Auto-processing option */}
            <div className="flex items-center space-x-2 py-2">
              <Checkbox 
                id="auto-trigger" 
                checked={autoTrigger}
                onCheckedChange={(checked) => setAutoTrigger(!!checked)}
              />
              <Label htmlFor="auto-trigger" className="text-sm cursor-pointer">
                Auto-process cards when moved to this column
              </Label>
            </div>
          </div>
        </div>
        
        {/* Footer with actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between">
          <div>
            {modalState.isSuggestionMode && suggestion && showingSuggestion && (
              <Button 
                variant="outline"
                onClick={handleApplySuggestion}
                disabled={isSubmitting}
                className="text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                size="sm"
              >
                Apply Suggestion
              </Button>
            )}
          </div>
          
          <div className="flex space-x-2">
            {modalState.isSuggestionMode ? (
              <Button 
                variant="outline" 
                onClick={handleDismissSuggestion} 
                disabled={isSubmitting} 
                size="sm"
              >
                Dismiss
              </Button>
            ) : (
              <Button 
                variant="outline" 
                onClick={onClose} 
                disabled={isSubmitting} 
                size="sm"
              >
                Cancel
              </Button>
            )}
            
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700 text-white"
              size="sm"
            >
              {isSubmitting ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}