import React, { useState, useEffect } from "react";
import { 
  Drawer, 
  DrawerContent, 
  DrawerFooter, 
  DrawerHeader,
  DrawerTitle,
  DrawerClose 
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Column } from "@shared/schema";
import { 
  X, 
  Sparkles, 
  Trash2, 
  AlertTriangle, 
  CheckCircle,
  Loader2 
} from "lucide-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue
} from "@/components/ui/select";

interface LaneConfigDrawerProps {
  column: Column;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: () => void;
  isSuggestionMode?: boolean;
  cardId?: number | null;
  onSave?: (column: Partial<Column>) => Promise<void>;
}

export function LaneConfigDrawer({
  column,
  isOpen,
  onClose,
  onDelete,
  isSuggestionMode = false,
  cardId = null,
  onSave
}: LaneConfigDrawerProps) {
  const [name, setName] = useState(column.name);
  const [gptAssigned, setGptAssigned] = useState(column.gptAssigned || false);
  const [gptName, setGptName] = useState(column.gptName || "");
  const [gptInstructions, setGptInstructions] = useState(column.gptInstructions || "");
  const [gptColor, setGptColor] = useState(column.gptColor || "Peach");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();

  // Initialize state when the drawer opens
  useEffect(() => {
    if (isOpen) {
      setName(column.name);
      setGptAssigned(column.gptAssigned || false);
      setGptName(column.gptName || "");
      setGptInstructions(column.gptInstructions || "");
      setGptColor(column.gptColor || "Peach");
    }
  }, [isOpen, column]);

  if (!isOpen) return null;

  const getColorStyle = (colorName: string) => {
    const colors: Record<string, { bg: string, text: string, border: string }> = {
      "Peach": { bg: "bg-[#FEE9D7]", text: "text-[#E25B3D]", border: "border-[#F7C9B0]" },
      "Sky": { bg: "bg-[#E1F2FE]", text: "text-[#2E7EC9]", border: "border-[#B7DCF7]" }, 
      "Lavender": { bg: "bg-[#F6E6FF]", text: "text-[#C235D1]", border: "border-[#E9CEFB]" },
      "Mint": { bg: "bg-[#DDFFE7]", text: "text-[#1A9E5E]", border: "border-[#C1EDD4]" },
      "Aqua": { bg: "bg-[#E0F9FF]", text: "text-[#3992B0]", border: "border-[#C3E8F4]" }
    };
    return colors[colorName] || colors["Peach"];
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const updatedColumn = {
        name,
        gptAssigned,
        gptName: gptAssigned ? gptName : "",
        gptInstructions: gptAssigned ? gptInstructions : "",
        gptColor: gptAssigned ? gptColor : "",
      };
      
      if (onSave) {
        await onSave(updatedColumn);
      } else {
        await apiRequest("PATCH", `/api/columns/${column.id}`, updatedColumn);
        queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      }
      
      toast({
        title: "Success",
        description: "Lane settings updated successfully",
      });
      
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update lane settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
    }
    onClose();
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[90vh]">
        <div className="mx-auto w-full max-w-4xl">
          <DrawerHeader className="px-6 pt-6 pb-2">
            <div className="flex items-center justify-between">
              <DrawerTitle>
                {isSuggestionMode ? "AI Prompt Suggestion" : "Lane Configuration"}
              </DrawerTitle>
              <DrawerClose className="rounded-full">
                <X className="h-4 w-4" />
              </DrawerClose>
            </div>
          </DrawerHeader>
          
          <div className="px-6 pb-6 overflow-y-auto space-y-6 max-h-[calc(100vh-10rem)]">
            {/* Lane Name */}
            <div className="space-y-2">
              <Label htmlFor="lane-name" className="text-sm font-medium">Lane Name</Label>
              <Input
                id="lane-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter lane name"
                className="w-full"
              />
            </div>
            
            {/* AI Assistant Toggle */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="enable-ai"
                  checked={gptAssigned}
                  onCheckedChange={setGptAssigned}
                />
                <Label htmlFor="enable-ai" className="text-sm font-medium">Enable AI Assistant for this lane</Label>
              </div>
            </div>
            
            {/* AI Assistant Configuration - only visible when enabled */}
            {gptAssigned && (
              <div className="space-y-4 rounded-md p-4 bg-gray-50">
                {/* AI Assistant Name */}
                <div className="space-y-2">
                  <Label htmlFor="ai-name" className="text-sm font-medium">AI Assistant Name</Label>
                  <Input
                    id="ai-name"
                    value={gptName}
                    onChange={(e) => setGptName(e.target.value)}
                    placeholder="Enter name for the AI assistant"
                    className="w-full"
                  />
                </div>
                
                {/* AI Assistant Color */}
                <div className="space-y-2">
                  <Label htmlFor="ai-color" className="text-sm font-medium">AI Assistant Color</Label>
                  <Select value={gptColor} onValueChange={setGptColor}>
                    <SelectTrigger id="ai-color" className="w-full">
                      <SelectValue placeholder="Select a color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Peach">
                        <div className="flex items-center">
                          <div className="w-4 h-4 rounded-full bg-[#FEE9D7] border border-[#F7C9B0] mr-2"></div>
                          <span>Peach</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Sky">
                        <div className="flex items-center">
                          <div className="w-4 h-4 rounded-full bg-[#E1F2FE] border border-[#B7DCF7] mr-2"></div>
                          <span>Sky</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Lavender">
                        <div className="flex items-center">
                          <div className="w-4 h-4 rounded-full bg-[#F6E6FF] border border-[#E9CEFB] mr-2"></div>
                          <span>Lavender</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Mint">
                        <div className="flex items-center">
                          <div className="w-4 h-4 rounded-full bg-[#DDFFE7] border border-[#C1EDD4] mr-2"></div>
                          <span>Mint</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Aqua">
                        <div className="flex items-center">
                          <div className="w-4 h-4 rounded-full bg-[#E0F9FF] border border-[#C3E8F4] mr-2"></div>
                          <span>Aqua</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* AI Assistant Instructions */}
                <div className="space-y-2">
                  <Label htmlFor="ai-instructions" className="text-sm font-medium">
                    AI Instructions
                    <span className="block text-xs text-gray-500 font-normal mt-1">
                      Provide detailed instructions for how the AI should assist with cards in this lane
                    </span>
                  </Label>
                  <Textarea
                    id="ai-instructions"
                    value={gptInstructions}
                    onChange={(e) => setGptInstructions(e.target.value)}
                    placeholder="Enter instructions for the AI assistant..."
                    className="min-h-[150px]"
                  />
                </div>
                
                {/* AI Preview */}
                <div className="mt-4">
                  <div className="text-sm font-medium mb-2">Preview</div>
                  <div className={`p-3 rounded-md ${getColorStyle(gptColor).bg} ${getColorStyle(gptColor).text} border ${getColorStyle(gptColor).border}`}>
                    <div className="flex items-center">
                      <Sparkles className="h-4 w-4 mr-2" />
                      <div className="font-medium">{gptName || "AI Assistant"}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex justify-between">
              {onDelete && (
                <Button 
                  variant="outline" 
                  onClick={handleDelete}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Lane
                </Button>
              )}
              
              <div className="ml-auto flex space-x-2">
                <Button 
                  variant="outline" 
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}