import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  X, FileText, Users, Paperclip, Calendar, 
  Zap, Settings, Copy, Move, Trash2, MessageSquare, AlignLeft, Sparkles 
} from "lucide-react";
import { GPTOutput } from "@/components/gpt/gpt-output";
import { GPTChat } from "@/components/gpt/gpt-chat";
import { AttachmentItem } from "@/components/gpt/attachment-item";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCardProcessing } from "@/hooks/use-card-processing";
import { Card as CardType, Column, Chat, Attachment } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface CardModalProps {
  card: CardType & { 
    chats?: Chat[],
    attachments?: Attachment[]
  };
  column: Column;
  columns: Column[];
  isOpen: boolean;
  onClose: () => void;
  onDelete: (cardId: number) => void;
  onMove: (cardId: number, sourceColumnId: number, destinationColumnId: number) => void;
}

export function CardModal({ 
  card, 
  column, 
  columns,
  isOpen, 
  onClose, 
  onDelete,
  onMove
}: CardModalProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || "");
  const [isSaving, setIsSaving] = useState(false);
  const [showMoveOptions, setShowMoveOptions] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  // Get real-time processing status
  const { isProcessing, gptOutput, chats, attachments } = useCardProcessing(card.id);

  useEffect(() => {
    if (isOpen) {
      setTitle(card.title);
      setDescription(card.description || "");
    }
  }, [isOpen, card]);

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

  const handleSaveTitle = async () => {
    if (title.trim() === "") return;
    if (title === card.title) return;

    setIsSaving(true);
    try {
      await apiRequest("PATCH", `/api/cards/${card.id}`, { title });
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      // Update the card reference in state to match what's saved
      card.title = title;
      toast({
        title: "Success",
        description: "Card title updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update card title",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDescription = async () => {
    if (description === card.description) return;

    setIsSaving(true);
    try {
      await apiRequest("PATCH", `/api/cards/${card.id}`, { description });
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      // Update the card reference in state to match what's saved
      card.description = description;
      toast({
        title: "Success",
        description: "Card description updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update card description",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetriggerGPT = async () => {
    try {
      await apiRequest("POST", `/api/cards/${card.id}/trigger-gpt`, {});
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      toast({
        title: "Success",
        description: "GPT processing triggered",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to trigger GPT processing",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    onDelete(card.id);
  };

  const handleMove = async (destinationColumnId: number) => {
    if (destinationColumnId === column.id) {
      setShowMoveOptions(false);
      return;
    }
    
    onMove(card.id, column.id, destinationColumnId);
    setShowMoveOptions(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 overflow-hidden">
      <div 
        ref={modalRef}
        className="bg-white rounded-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-xl"
      >
        {/* Header - Fixed at the top with prominent title */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <div className="flex-1 flex items-center gap-3">
            <Badge variant="outline" className="text-xs font-normal py-0 h-5 bg-gray-50">
              {column.name}
            </Badge>
            <Textarea 
              className="w-full text-xl font-medium bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-transparent resize-none overflow-hidden py-0 px-0" 
              rows={1}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Save title button appears if title is edited */}
        {title !== card.title && (
          <div className="px-6 py-2 bg-gray-50 flex justify-end border-b border-gray-100">
            <Button 
              size="sm" 
              variant="default" 
              onClick={handleSaveTitle}
              disabled={isSaving || title.trim() === ""}
            >
              Save Title
            </Button>
          </div>
        )}
        
        {/* Main Content Area - Scrollable */}
        <div className="overflow-y-auto flex-1 px-6 pt-5 pb-6">
          {/* Description Section - Prompt Context */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <AlignLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <h3 className="text-sm font-medium text-gray-700">Prompt Context</h3>
            </div>
            <div className="pl-6">
              <Textarea
                className="text-sm border-gray-200 focus:border-gray-300 focus:ring-gray-300/20 min-h-[100px] resize-y"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add context for the AI to understand your task..."
              />
              {description !== (card.description || "") && (
                <div className="mt-2 flex justify-end">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleSaveDescription}
                    disabled={isSaving}
                  >
                    Save Context
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <Separator className="my-6" />
          
          {/* GPT Content & Chat Interface - Expanded and prominent */}
          {column.gptAssigned && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-green-700">AI</span>
                  </div>
                  <h3 className="font-medium text-gray-800">{column.gptName || "AI Assistant"}</h3>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-xs text-green-700 hover:bg-green-50 border-green-200"
                  onClick={handleRetriggerGPT}
                  disabled={isProcessing}
                >
                  <Zap className="h-3 w-3 mr-1" />
                  Retrigger
                </Button>
              </div>
              
              {/* Processing Indicator */}
              {isProcessing ? (
                <div className="rounded-lg border border-yellow-100 bg-yellow-50 flex items-center justify-center p-6 mb-4">
                  <div className="flex items-center text-yellow-700">
                    <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    AI is working on your request...
                  </div>
                </div>
              ) : null}
              
              {/* Unified Chat Interface with Output */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="px-3 py-2 border-b border-gray-100">
                  <div className="text-sm font-medium text-gray-700 flex items-center">
                    <div className="flex items-center mr-auto">
                      Conversation with {column.gptName || 'AI Assistant'}
                    </div>
                    {gptOutput && (
                      <Badge variant="outline" className="ml-auto text-xs font-normal py-0 h-5 bg-green-50 border-green-200 text-green-700">
                        Output Ready
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div 
                  className="flex-1 overflow-y-auto px-4 py-3 space-y-4 flex flex-col min-h-[240px] max-h-[300px]"
                >
                  {/* Final AI Output (highlighted special) */}
                  {gptOutput && !isProcessing && (
                    <div className="flex flex-col items-start self-start max-w-[90%] mt-2">
                      <div className="flex items-start">
                        <div className="w-6 h-6 rounded-full bg-green-500 mr-2 flex-shrink-0 flex items-center justify-center">
                          <Sparkles className="h-3 w-3 text-white" />
                        </div>
                        <div className="bg-green-50 text-gray-800 rounded-lg rounded-tl-none border-2 border-green-200 py-2 px-3 shadow-sm">
                          <div className="text-xs font-medium text-green-800 mb-1">Final Output</div>
                          <div className="whitespace-pre-line">{gptOutput}</div>
                        </div>
                      </div>
                      <div className="text-[10px] text-green-600 font-medium mt-1 px-2 ml-8">
                        This output will be passed to the next column
                      </div>
                    </div>
                  )}
                  
                  {/* Chat Messages */}
                  <GPTChat 
                    cardId={card.id} 
                    chats={chats} 
                    gptName={column.gptName || "AI Assistant"}
                    embedded={true}
                  />
                </div>
                
                {/* Chat Input Box will be part of GPTChat component */}
              </div>
              
              {/* Attachments Section - Clear separation and grouping */}
              {attachments.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <div className="flex items-center mb-3 gap-2">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">Attachments</h3>
                  </div>
                  <div className="grid gap-2 pl-6">
                    {attachments.map((attachment) => (
                      <AttachmentItem 
                        key={attachment.id} 
                        attachment={attachment} 
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer Actions - Fixed at bottom */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          {/* Actions on the left */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-sm text-gray-600"
                onClick={() => setShowMoveOptions(!showMoveOptions)}
              >
                <Move className="h-4 w-4 mr-1" />
                Move
              </Button>
              
              {showMoveOptions && (
                <div className="absolute bottom-full left-0 bg-white shadow-lg rounded-md border border-gray-200 z-10 mb-1 w-48">
                  <div className="p-2">
                    <div className="text-xs font-medium mb-2 text-gray-500">Move to column:</div>
                    {columns.map((col) => (
                      <div 
                        key={col.id} 
                        className={`
                          text-sm p-2 rounded cursor-pointer hover:bg-gray-50
                          ${col.id === column.id ? 'bg-gray-50 text-muted-foreground' : ''}
                        `}
                        onClick={() => handleMove(col.id)}
                      >
                        {col.name} {col.id === column.id && '(current)'}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Delete button on the right */}
          <Button 
            variant="ghost" 
            size="sm"
            className="text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
