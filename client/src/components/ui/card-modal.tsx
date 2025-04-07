import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  X, 
  FileText, 
  Users, 
  Paperclip, 
  Calendar, 
  RefreshCw,
  Zap, 
  Settings, 
  Copy, 
  Move, 
  Trash2, 
  MessageSquare, 
  AlignLeft, 
  Sparkles,
  AlertTriangle
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
import { ProcessingIndicator } from "@/components/ui/processing-indicator";

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
  // Get real-time processing status with more frequent polling for chat messages
  const { 
    isProcessing, 
    isProcessingTimedOut,
    processingError,
    gptOutput, 
    chats, 
    attachments,
    resetProcessingState 
  } = useCardProcessing(card.id);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize state when the modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(card.title);
      setDescription(card.description || "");
    }
  }, [isOpen, card]);

  // Handle auto-height for text area after description is set
  useEffect(() => {
    if (textAreaRef.current) {
      // Reset height to minimal value first
      textAreaRef.current.style.height = '24px';
      // Then set it to scrollHeight to fit content exactly
      const scrollHeight = textAreaRef.current.scrollHeight;
      textAreaRef.current.style.height = scrollHeight + 'px';
    }
  }, [description, isOpen]);

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
  
  // Handle manually resetting a card's processing status
  // Useful when a card is stuck in processing
  const handleResetProcessing = async () => {
    try {
      await apiRequest("PATCH", `/api/cards/${card.id}`, { 
        processing: false
      });
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: [`/api/cards/${card.id}/processing-status`] });
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      toast({
        title: "Processing Reset",
        description: "Card processing status has been reset",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset processing status",
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
        className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
      >
        {/* Header - Fixed at the top with single-line title */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <div className="flex-1 flex items-center overflow-hidden">
            <input 
              className="w-full text-xl font-medium bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-transparent overflow-hidden py-0 px-0" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSaveTitle}
            />
          </div>
          <Button variant="ghost" size="icon" className="rounded-full flex-shrink-0" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Column tag below title - moved from header */}
        <div className="px-6 pt-2 pb-0 flex">
          <Badge variant="outline" className="text-xs font-normal py-0 h-5 bg-gray-50">
            {column.name}
          </Badge>
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
        
        {/* Main Content Area - Using flex layout instead of scroll on this container */}
        <div 
          className="flex-1 px-6 pt-3 pb-5 flex flex-col"
        >
          {/* Description Section - Prompt Context */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <AlignLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <h3 className="text-sm font-medium text-gray-700">Prompt Context</h3>
            </div>
            <div className="pl-6">
              {/* Dynamic height text area that adapts to content and is read-only until clicked */}
              <div 
                className={`rounded-md ${
                  description ? 
                    'border-0 focus-within:border focus-within:border-gray-200' : 
                    'border border-dashed border-gray-200 hover:border-gray-300'
                }`}
              >
                <div 
                  className={`min-h-0 w-full relative ${description ? '' : 'cursor-text'}`}
                  onClick={(e) => {
                    // Find the textarea and focus it when the container is clicked
                    const textarea = e.currentTarget.querySelector('textarea');
                    if (textarea) textarea.focus();
                  }}
                >
                  {!description && (
                    <div className="absolute inset-0 flex items-center text-gray-400 px-3 py-1 text-sm pointer-events-none">
                      Add context for the AI to understand your task...
                    </div>
                  )}
                  <textarea
                    ref={textAreaRef}
                    className={`w-full text-sm py-1 px-3 overflow-hidden bg-transparent ${
                      description ? 'border-0 focus:outline-none focus:ring-0' : 'opacity-0'
                    }`}
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      // Auto-adjust height - start with minimal height
                      e.target.style.height = '24px';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onFocus={(e) => {
                      // Show border on focus
                      e.target.parentElement?.classList.add('border');
                      e.target.parentElement?.classList.add('border-gray-200');
                      e.target.classList.remove('opacity-0');
                      // Auto-adjust height
                      e.target.style.height = '24px';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    onBlur={(e) => {
                      if (!description) {
                        e.target.classList.add('opacity-0');
                        e.target.parentElement?.classList.remove('border');
                      }
                      if (description !== (card.description || "")) {
                        handleSaveDescription();
                      }
                    }}
                    style={{
                      height: description ? 'auto' : '24px', // Single line height
                      resize: 'none',
                      lineHeight: '1.5',
                      minHeight: '24px' // Minimal single line height
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          
          <Separator className="my-2" />
          
          {/* GPT Content & Chat Interface - Expanded and prominent */}
          {column.gptAssigned && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-green-700">AI</span>
                  </div>
                  <h3 className="font-medium text-gray-800 text-sm">{column.gptName || "AI Assistant"}</h3>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-xs text-green-700 hover:bg-green-50 border-green-200 h-7 px-2"
                  onClick={handleRetriggerGPT}
                  disabled={isProcessing}
                >
                  <Zap className="h-3 w-3 mr-1" />
                  Retrigger
                </Button>
              </div>
              
              {/* Use the unified ProcessingIndicator component */}
              <ProcessingIndicator 
                isProcessing={isProcessing}
              />
              
              {/* Unified Chat Interface with Output */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col flex-grow">
                {/* GPTChat component contains both the message area and the input */}
                <GPTChat 
                  cardId={card.id} 
                  chats={chats} 
                  gptName={column.gptName || "AI Assistant"}
                  gptColor={column.gptColor}
                  embedded={true}
                  finalOutput={gptOutput}
                  isProcessing={isProcessing}
                />
              </div>
              
              {/* Attachments Section - Clear separation and grouping */}
              {attachments.length > 0 && (
                <div className="mt-4 pt-2 border-t border-gray-100">
                  <div className="flex items-center mb-2 gap-1.5">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="text-xs font-medium">Attachments ({attachments.length})</h3>
                  </div>
                  <div className="grid gap-1.5 pl-5">
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
