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
import { Check, X, Sparkles, AlertCircle, Diff, Loader2, ArrowRight, ThumbsUp, ThumbsDown, Plus, ListChecks, XCircle } from "lucide-react";
import { useModalContext } from "@/contexts/ModalContext";

interface AssignGPTModalProps {
  column: Column;
  isOpen: boolean;
  onClose: () => void;
  isSuggestionMode?: boolean;
  cardId?: number | null;
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

// Simple interface for bullet point items
export interface BulletPoint {
  id: string;
  text: string;
  category?: 'do' | 'dont' | 'general';
  excluded?: boolean;
}

// Parse instructions text to extract do's and don'ts
export const parseInstructions = (text: string): { dos: BulletPoint[]; donts: BulletPoint[] } => {
  const result = { 
    dos: [] as BulletPoint[], 
    donts: [] as BulletPoint[] 
  };
  
  if (!text) return result;
  
  // Check if the text already has a structured format with Do's and Don'ts
  const doSection = text.match(/DO'S:([\s\S]*?)(?=DON'TS:|$)/i);
  const dontSection = text.match(/DON'TS:([\s\S]*?)$/i);
  
  if (doSection || dontSection) {
    // Extract bullet points from the Do's section
    if (doSection && doSection[1]) {
      const doPoints = doSection[1].split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('- ') || line.startsWith('• '))
        .map(line => ({
          id: crypto.randomUUID(),
          text: line.replace(/^[-•]\s+/, ''),
          category: 'do' as const
        }));
      result.dos = doPoints;
    }
    
    // Extract bullet points from the Don'ts section
    if (dontSection && dontSection[1]) {
      const dontPoints = dontSection[1].split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('- ') || line.startsWith('• '))
        .map(line => ({
          id: crypto.randomUUID(),
          text: line.replace(/^[-•]\s+/, ''),
          category: 'dont' as const
        }));
      result.donts = dontPoints;
    }
  } else {
    // If not in the structured format, treat all lines as do's
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => ({
        id: crypto.randomUUID(),
        text: line.startsWith('- ') || line.startsWith('• ') 
          ? line.replace(/^[-•]\s+/, '') 
          : line,
        category: 'do' as const
      }));
    result.dos = lines;
  }
  
  return result;
};

// Convert do's and don'ts back to a formatted string
export const formatInstructions = (dos: BulletPoint[], donts: BulletPoint[]): string => {
  let result = '';
  
  if (dos.length > 0) {
    result += "DO'S:\n";
    dos.forEach(item => {
      result += `- ${item.text}\n`;
    });
  }
  
  if (donts.length > 0) {
    if (result) result += '\n';
    result += "DON'TS:\n";
    donts.forEach(item => {
      result += `- ${item.text}\n`;
    });
  }
  
  return result;
};

export function AssignGPTModal({ column, isOpen, onClose, isSuggestionMode, cardId }: AssignGPTModalProps) {
  const [gptName, setGptName] = useState<string>(column.gptName || "GPT Assistant");
  const [instructions, setInstructions] = useState<string>(column.gptInstructions || "");
  
  // State for the structured bullet points
  const [dosList, setDosList] = useState<BulletPoint[]>([]);
  const [dontsList, setDontsList] = useState<BulletPoint[]>([]);
  
  // State for new bullet point input
  const [newDoPoint, setNewDoPoint] = useState<string>("");
  const [newDontPoint, setNewDontPoint] = useState<string>("");
  
  const [gptColor, setGptColor] = useState<string>(column.gptColor || "");
  const [autoTrigger, setAutoTrigger] = useState<boolean>(column.autoTrigger !== false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [suggestion, setSuggestion] = useState<{ rationale: string; suggestedInstructions: string } | null>(null);
  const [showingSuggestion, setShowingSuggestion] = useState<boolean>(!!isSuggestionMode);
  const { toast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  const { modalState } = useModalContext();
  
  // State for storing parsed suggestion items separately
  const [parsedSuggestions, setParsedSuggestions] = useState<BulletPoint[]>([]);

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
  
  // Function to parse suggestions into individual selectable items
  const parseSuggestionIntoItems = (suggestionText: string): BulletPoint[] => {
    // First, try to parse using the standard parseInstructions
    const { dos, donts } = parseInstructions(suggestionText);
    
    // Combine dos and donts into a single array of bullet points
    const combined: BulletPoint[] = [
      ...dos.map(item => ({ ...item, category: 'do' as const })),
      ...donts.map(item => ({ ...item, category: 'dont' as const }))
    ];
    
    // If we have structured content, return it
    if (combined.length > 0) {
      return combined;
    }
    
    // Otherwise, split by lines and create a bullet point for each line
    return suggestionText
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => ({
        id: crypto.randomUUID(),
        text: line.trim(),
        category: 'general' as const
      }));
  };

  // Reset form state when modal opens and fetch suggestion if in suggestion mode
  useEffect(() => {
    if (!isOpen) return;
    
    console.log(`[AssignGPTModal] Modal opened with state:`, { 
      isSuggestionMode: modalState.isSuggestionMode,
      columnId: modalState.columnId,
      cardId: modalState.cardId,
      currentColumnId: column.id 
    });
    
    setGptName(column.gptName || "GPT Assistant");
    const instructionsText = column.gptInstructions || "";
    setInstructions(instructionsText);
    
    // Parse the instructions into do's and don'ts lists
    const { dos, donts } = parseInstructions(instructionsText);
    setDosList(dos);
    setDontsList(donts);
    
    setAutoTrigger(column.autoTrigger !== false);
    
    // Check if we're in suggestion mode and fetch suggestion
    if (modalState.isSuggestionMode && modalState.columnId === column.id && modalState.cardId) {
      console.log(`[AssignGPTModal] In suggestion mode for column ${column.id}, card ${modalState.cardId}`);
      
      // We'll set the suggestion only after we confirm it exists
      setShowingSuggestion(true);
      // Initially set suggestion to null until we fetch the actual suggestion
      setSuggestion(null);
      setParsedSuggestions([]);
      console.log(`[AssignGPTModal] Initial state set, waiting for suggestion data`);
      
      const fetchSuggestion = async () => {
        try {
          setIsSubmitting(true);
          console.log(`[AssignGPTModal] Fetching suggestion for column ${column.id}, card ${modalState.cardId}`);
          
          // First, verify if suggestion exists 
          const checkResponse = await fetch(`/api/columns/${column.id}/prompt-suggestion/check/${modalState.cardId}`);
          
          if (!checkResponse.ok) {
            throw new Error(`Failed to check suggestion status: ${checkResponse.status} ${checkResponse.statusText}`);
          }
          
          const checkData = await checkResponse.json();
          console.log(`[AssignGPTModal] Suggestion check:`, checkData);
          
          if (!checkData.hasSuggestion) {
            console.log(`[AssignGPTModal] No suggestion available in check response`);
            
            // No suggestion available - keep suggestion as null
            toast({
              title: "No Suggestion Available",
              description: "There are no suggestions available for this column",
              variant: "default"
            });
            
            // Close modal or stay in normal edit mode
            setIsSubmitting(false);
            setSuggestion(null);
            setShowingSuggestion(false);
            return;
          }
          
          // If we got here, a suggestion exists - now fetch it directly using fetch instead of apiRequest
          // The issue was that apiRequest might be processing the response differently
          console.log(`[AssignGPTModal] Using direct fetch for suggestion endpoint`);
          const response = await fetch(`/api/columns/${column.id}/prompt-suggestion/${modalState.cardId}`);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch suggestion: ${response.status}`);
          }
          
          interface SuggestionResponse {
            suggestion?: { rationale: string; suggestedInstructions: string }
          }
          
          const data = await response.json() as SuggestionResponse;
          console.log(`[AssignGPTModal] Suggestion response:`, data);
          
          if (data && data.suggestion) {
            console.log(`[AssignGPTModal] Setting suggestion:`, data.suggestion);
            setSuggestion(data.suggestion);
            
            // Parse the suggestion into individual items for selective application
            const parsedItems = parseSuggestionIntoItems(data.suggestion.suggestedInstructions);
            setParsedSuggestions(parsedItems);
            console.log(`[AssignGPTModal] Parsed suggestion into ${parsedItems.length} items`);
            
            // Ensure state is set to showing
            setShowingSuggestion(true);
            console.log(`[AssignGPTModal] showingSuggestion confirmed to be true with real data`);
          } else {
            console.log(`[AssignGPTModal] Invalid suggestion data found in response`);
            // No valid suggestion data found, don't display anything
            setSuggestion(null);
            setShowingSuggestion(false);
            toast({
              title: "No Valid Suggestion",
              description: "No valid suggestion data found for this column",
              variant: "default"
            });
          }
        } catch (error) {
          console.error("Failed to fetch suggestion:", error);
          // Reset suggestion state on error
          setSuggestion(null);
          setShowingSuggestion(false);
          
          // Notify user about the error
          toast({
            title: "Error Fetching Suggestion",
            description: "Could not retrieve suggestion data",
            variant: "destructive"
          });
        } finally {
          setIsSubmitting(false);
        }
      };
      
      fetchSuggestion();
    } else {
      // Reset suggestion state when not in suggestion mode
      console.log(`[AssignGPTModal] Not in suggestion mode, resetting state`);
      setSuggestion(null);
      setShowingSuggestion(false);
    }
  }, [isOpen, column, modalState, toast]);

  // Functions to manage bullet points
  const addDoPoint = () => {
    if (newDoPoint.trim()) {
      const newPoint: BulletPoint = {
        id: crypto.randomUUID(),
        text: newDoPoint.trim(),
        category: 'do'
      };
      setDosList([...dosList, newPoint]);
      setNewDoPoint('');
      
      // Also update the instructions string
      const updatedInstructions = formatInstructions([...dosList, newPoint], dontsList);
      setInstructions(updatedInstructions);
    }
  };
  
  const addDontPoint = () => {
    if (newDontPoint.trim()) {
      const newPoint: BulletPoint = {
        id: crypto.randomUUID(),
        text: newDontPoint.trim(),
        category: 'dont'
      };
      setDontsList([...dontsList, newPoint]);
      setNewDontPoint('');
      
      // Also update the instructions string
      const updatedInstructions = formatInstructions(dosList, [...dontsList, newPoint]);
      setInstructions(updatedInstructions);
    }
  };
  
  const removeDoPoint = (id: string) => {
    const updatedDosList = dosList.filter(point => point.id !== id);
    setDosList(updatedDosList);
    
    // Also update the instructions string
    const updatedInstructions = formatInstructions(updatedDosList, dontsList);
    setInstructions(updatedInstructions);
  };
  
  const removeDontPoint = (id: string) => {
    const updatedDontsList = dontsList.filter(point => point.id !== id);
    setDontsList(updatedDontsList);
    
    // Also update the instructions string
    const updatedInstructions = formatInstructions(dosList, updatedDontsList);
    setInstructions(updatedInstructions);
  };
  
  const handleSubmit = async () => {
    // Format final instructions from bullet points
    const formattedInstructions = formatInstructions(dosList, dontsList);
    
    if (!formattedInstructions.trim()) {
      toast({
        title: "Error",
        description: "Please add at least one instruction for the GPT",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await apiRequest("PATCH", `/api/columns/${column.id}/assign-gpt`, {
        gptAssigned: true,
        gptName,
        gptInstructions: formattedInstructions,
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
      // Apply all suggestions (equivalent to the old behavior)
      // This is kept for backward compatibility, but the new UI uses the inline handler
      
      // Update the instructions with the complete suggestion
      const suggestedText = suggestion.suggestedInstructions;
      setInstructions(suggestedText);
      
      // Parse the suggestion into dos and donts
      const { dos, donts } = parseInstructions(suggestedText);
      setDosList(dos);
      setDontsList(donts);
      
      // Hide the suggestion UI
      setShowingSuggestion(false);
      
      // Show a toast notification
      toast({
        title: "All Suggestions Applied",
        description: "All suggested instructions have been applied. Review and save to confirm."
      });
      
      // Remove suggestion from UI but keep modal open for review/editing
      setSuggestion(null);
      setParsedSuggestions([]);
      
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
          
          {modalState.isSuggestionMode && suggestion && (
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
              
              {/* Individually Selectable Suggestion Items */}
              {/* Debugging output for rendering conditions */}
              {/* {modalState.isSuggestionMode && <div>{JSON.stringify({suggestion: !!suggestion, showing: showingSuggestion})}</div>} */}
              {modalState.isSuggestionMode && suggestion && showingSuggestion ? (
                <div className="mb-4">
                  <div className="mb-2">
                    <h3 className="text-sm font-medium mb-2">Suggested Improvements</h3>
                    
                    <div className="space-y-3">
                      {/* Current Instructions View */}
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-gray-500">Current Instructions</Label>
                        <div className="border border-gray-200 rounded-md bg-gray-50 p-3 mb-3">
                          <Textarea
                            placeholder="No current instructions"
                            rows={3}
                            value={column.gptInstructions || ""}
                            readOnly
                            className="w-full resize-none border-0 bg-transparent p-0 focus-visible:ring-0 text-sm"
                          />
                        </div>
                      </div>
                      
                      {/* Suggested Items - Selectable */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-medium text-amber-600">Suggestions (Select which to apply)</Label>
                          <Badge variant="outline" className="text-xs py-0.5 px-2">
                            {parsedSuggestions.length} item{parsedSuggestions.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        
                        <div className="border border-amber-200 rounded-md">
                          <div className="divide-y divide-amber-100">
                            {parsedSuggestions.map((item) => (
                              <div 
                                key={item.id} 
                                className="flex items-start p-3 bg-amber-50 hover:bg-amber-100 group gap-2"
                              >
                                <Checkbox 
                                  id={`suggestion-${item.id}`}
                                  className="mt-1 data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600" 
                                  defaultChecked={true}
                                  onCheckedChange={(checked) => {
                                    // Mark item for inclusion/exclusion
                                    setParsedSuggestions(prev => 
                                      prev.map(s => s.id === item.id ? {...s, excluded: !checked} : s)
                                    );
                                  }}
                                />
                                <div className="flex-1">
                                  <label 
                                    htmlFor={`suggestion-${item.id}`}
                                    className="text-sm text-amber-900 block cursor-pointer"
                                  >
                                    {item.text}
                                  </label>
                                  {item.category && item.category !== 'general' && (
                                    <Badge 
                                      variant="outline" 
                                      className={`mt-1 text-xs py-0.5 px-1.5 ${
                                        item.category === 'do' 
                                          ? 'bg-green-50 text-green-700 border-green-200' 
                                          : 'bg-red-50 text-red-700 border-red-200'
                                      }`}
                                    >
                                      {item.category === 'do' ? 'Do' : "Don't"}
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                                  onClick={() => {
                                    // Remove item completely
                                    setParsedSuggestions(prev => 
                                      prev.filter(s => s.id !== item.id)
                                    );
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            
                            {parsedSuggestions.length === 0 && (
                              <div className="p-3 text-sm text-gray-500 text-center">
                                No suggestions available or all have been removed
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-gray-600 hover:bg-gray-100"
                        onClick={handleDismissSuggestion}
                      >
                        <ThumbsDown className="mr-2 h-4 w-4" />
                        Reject All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-amber-600 border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                        onClick={() => {
                          // Apply only the selected suggestions
                          const selectedSuggestions = parsedSuggestions
                            .filter(item => !item.excluded)
                            .map(item => item.text);
                            
                          if (selectedSuggestions.length === 0) {
                            toast({
                              title: "No Suggestions Selected",
                              description: "Please select at least one suggestion to apply",
                            });
                            return;
                          }
                          
                          // Format selected suggestions based on categories
                          const doItems = parsedSuggestions
                            .filter(item => !item.excluded && item.category === 'do')
                            .map(item => ({ id: item.id, text: item.text }));
                            
                          const dontItems = parsedSuggestions
                            .filter(item => !item.excluded && item.category === 'dont')
                            .map(item => ({ id: item.id, text: item.text }));
                            
                          const generalItems = parsedSuggestions
                            .filter(item => !item.excluded && (!item.category || item.category === 'general'))
                            .map(item => ({ id: item.id, text: item.text }));
                            
                          // Prioritize categorized items, fall back to general if needed
                          if (doItems.length > 0 || dontItems.length > 0) {
                            // We have categorized items, use them
                            setDosList(prev => [...prev, ...doItems]);
                            setDontsList(prev => [...prev, ...dontItems]);
                            
                            // Update instructions using the formatInstructions function
                            const updatedInstructions = formatInstructions(
                              [...dosList, ...doItems], 
                              [...dontsList, ...dontItems]
                            );
                            setInstructions(updatedInstructions);
                          } else {
                            // Just use general items as a block of text
                            const newText = generalItems.map(item => item.text).join('\n');
                            setInstructions(prev => prev ? `${prev}\n\n${newText}` : newText);
                            
                            // Also parse this text to update the do's and don'ts lists
                            const { dos, donts } = parseInstructions(newText);
                            setDosList(prev => [...prev, ...dos]);
                            setDontsList(prev => [...prev, ...donts]);
                          }
                          
                          // Hide the suggestion UI
                          setShowingSuggestion(false);
                          
                          // Show a success toast
                          toast({
                            title: "Selected Suggestions Applied",
                            description: `${selectedSuggestions.length} suggestion(s) have been applied. Review and save to confirm.`,
                          });
                          
                          // Clear suggestion from UI
                          setSuggestion(null);
                          setParsedSuggestions([]);
                          
                          // Mark suggestion as handled on the server
                          if (modalState.columnId) {
                            const endpoint = modalState.cardId 
                              ? `/api/columns/${modalState.columnId}/prompt-suggestion/accept/${modalState.cardId}`
                              : `/api/columns/${modalState.columnId}/prompt-suggestion/accept`;
                            
                            apiRequest("POST", endpoint, {})
                              .catch(error => {
                                console.error("Failed to accept suggestion:", error);
                              });
                          }
                        }}
                      >
                        <ThumbsUp className="mr-2 h-4 w-4" />
                        Apply Selected
                      </Button>
                    </div>
                  </div>
                  <Separator className="my-4" />
                </div>
              ) : null}
              
              {/* Structured Do's and Don'ts Lists */}
              <div className="grid grid-cols-1 gap-4 mt-3">
                {/* Do's Section */}
                <div className="border rounded-md p-3 bg-green-50 border-green-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-green-600" />
                      <Label className="text-sm font-semibold text-green-700">DO'S</Label>
                    </div>
                    <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">
                      {dosList.length} items
                    </Badge>
                  </div>
                  
                  {/* Bullet points list */}
                  <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                    {dosList.length > 0 ? (
                      dosList.map((item) => (
                        <div key={item.id} className="flex items-start gap-2 group">
                          <div className="flex-shrink-0 w-4 h-4 mt-1 text-green-500">•</div>
                          <div className="flex-1 text-sm">{item.text}</div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeDoPoint(item.id)}
                          >
                            <XCircle className="h-4 w-4 text-green-600" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-green-600/60 italic">Add instructions below for what the AI should do</p>
                    )}
                  </div>
                  
                  {/* Add new point input */}
                  <div className="flex gap-2 items-center mt-3">
                    <Input
                      placeholder="Add a new 'do' instruction..."
                      value={newDoPoint}
                      onChange={(e) => setNewDoPoint(e.target.value)}
                      className="text-sm border-green-200 focus-visible:ring-green-400"
                      onKeyDown={(e) => e.key === 'Enter' && addDoPoint()}
                    />
                    <Button 
                      type="button" 
                      size="icon" 
                      className="h-8 w-8 bg-green-100 hover:bg-green-200 text-green-600 border border-green-200"
                      onClick={addDoPoint}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Don'ts Section */}
                <div className="border rounded-md p-3 bg-red-50 border-red-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <Label className="text-sm font-semibold text-red-700">DON'TS</Label>
                    </div>
                    <Badge variant="outline" className="text-xs text-red-600 border-red-200 bg-red-50">
                      {dontsList.length} items
                    </Badge>
                  </div>
                  
                  {/* Bullet points list */}
                  <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                    {dontsList.length > 0 ? (
                      dontsList.map((item) => (
                        <div key={item.id} className="flex items-start gap-2 group">
                          <div className="flex-shrink-0 w-4 h-4 mt-1 text-red-500">•</div>
                          <div className="flex-1 text-sm">{item.text}</div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeDontPoint(item.id)}
                          >
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-red-600/60 italic">Add instructions below for what the AI should avoid</p>
                    )}
                  </div>
                  
                  {/* Add new point input */}
                  <div className="flex gap-2 items-center mt-3">
                    <Input
                      placeholder="Add a new 'don't' instruction..."
                      value={newDontPoint}
                      onChange={(e) => setNewDontPoint(e.target.value)}
                      className="text-sm border-red-200 focus-visible:ring-red-400"
                      onKeyDown={(e) => e.key === 'Enter' && addDontPoint()}
                    />
                    <Button 
                      type="button" 
                      size="icon" 
                      className="h-8 w-8 bg-red-100 hover:bg-red-200 text-red-600 border border-red-200"
                      onClick={addDontPoint}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Add clear bullet points for what the AI should and shouldn't do when processing cards
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