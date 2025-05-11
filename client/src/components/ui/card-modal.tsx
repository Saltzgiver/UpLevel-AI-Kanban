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
  AlertTriangle,
  History,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { GPTOutput } from "@/components/gpt/gpt-output";
import { GPTChat } from "@/components/gpt/gpt-chat";
import { AttachmentItem } from "@/components/gpt/attachment-item";
import { FileUpload } from "@/components/ui/file-upload";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCardProcessing } from "@/hooks/use-card-processing";
import { Card as CardType, Column, Chat, Attachment } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ProcessingIndicator } from "@/components/ui/processing-indicator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const [includeChatHistory, setIncludeChatHistory] = useState(card.includeChatHistory || false);
  const [isSaving, setIsSaving] = useState(false);
  const [showMoveOptions, setShowMoveOptions] = useState(false);
  const [descriptionChanged, setDescriptionChanged] = useState(false);
  const [isPromptContextExpanded, setIsPromptContextExpanded] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  // Get real-time processing status with more frequent polling for chat messages
  // Pass isDetailView=true to not show processing status in the modal
  const { 
    isProcessing, 
    isProcessingTimedOut,
    processingError,
    gptOutput, 
    chats, 
    attachments,
    resetProcessingState,
    rawProcessingStatus 
  } = useCardProcessing(card.id, true);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize state when the modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(card.title);
      setDescription(card.description || "");
      setIncludeChatHistory(card.includeChatHistory || false);
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
  
  // Scroll to the bottom of the chat container when the modal opens
  // or when new messages arrive
  useEffect(() => {
    if (isOpen && chatContainerRef.current) {
      // Small delay to ensure the content is rendered
      const timer = setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, chats, gptOutput]);

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
      // Reset the descriptionChanged state after saving successfully
      setDescriptionChanged(false);
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
  
  const handleChatHistoryToggle = async (checked: boolean) => {
    setIncludeChatHistory(checked);
    try {
      await apiRequest("PATCH", `/api/cards/${card.id}`, { includeChatHistory: checked });
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      
      // Update the card reference in state
      card.includeChatHistory = checked;
      
      toast({
        title: "Settings Updated",
        description: checked 
          ? "Chat history will be included in AI context" 
          : "Chat history will not be included in AI context (last response only)"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update card settings",
        variant: "destructive",
      });
      // Reset to previous value
      setIncludeChatHistory(!checked);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 overflow-hidden">
      <div 
        ref={modalRef}
        className="bg-white rounded-xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col shadow-xl"
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
        
        {/* Main Content Area - Scrollable */}
        <div className="overflow-y-auto flex-1 px-6 pt-3 pb-5">
          {/* Description Section - Collapsible Prompt Context */}
          <Collapsible className="mb-4" open={isPromptContextExpanded} onOpenChange={setIsPromptContextExpanded}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <div className="flex items-center gap-2 mb-2 hover:bg-gray-50 p-1 rounded-md cursor-pointer w-full">
                  <AlignLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <h3 className="text-sm font-medium text-gray-700">Prompt Context</h3>
                  <div className="ml-auto">
                    {isPromptContextExpanded ? 
                      <ChevronUp className="h-4 w-4 text-gray-400" /> : 
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    }
                  </div>
                </div>
              </CollapsibleTrigger>
            </div>
            
            <CollapsibleContent>
              <div className="pl-6">
                {/* Dynamic height text area that adapts to content and is read-only until clicked */}
                <div 
                  className={`rounded-md ${
                    description ? 
                      'border border-gray-200 bg-gray-50/50' : 
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
                    <div className="relative">
                      <textarea
                        ref={textAreaRef}
                        className={`w-full text-sm py-2 px-3 bg-transparent ${
                          description ? 'border-0 focus:outline-none focus:ring-0 overflow-auto' : 'opacity-0 overflow-hidden'
                        }`}
                        value={description}
                        onChange={(e) => {
                          setDescription(e.target.value);
                          // Set descriptionChanged to true if the content has changed from the original
                          setDescriptionChanged(e.target.value !== (card.description || ""));
                          // Only auto-adjust height up to a point
                          e.target.style.height = '24px';
                          const newHeight = Math.min(e.target.scrollHeight, 120); // Max 120px height
                          e.target.style.height = newHeight + 'px';
                        }}
                        onFocus={(e) => {
                          // Show border on focus
                          e.target.parentElement?.parentElement?.classList.add('border');
                          e.target.parentElement?.parentElement?.classList.add('border-gray-200');
                          e.target.classList.remove('opacity-0');
                          // Auto-adjust height with max
                          e.target.style.height = '24px';
                          const newHeight = Math.min(e.target.scrollHeight, 120);
                          e.target.style.height = newHeight + 'px';
                        }}
                        onBlur={(e) => {
                          if (!description) {
                            e.target.classList.add('opacity-0');
                            e.target.parentElement?.parentElement?.classList.remove('border');
                          }
                          // Check if description has changed but don't automatically save
                          setDescriptionChanged(description !== (card.description || ""));
                        }}
                        style={{
                          height: description ? 'auto' : '24px', // Single line height
                          resize: 'none',
                          lineHeight: '1.5',
                          minHeight: '24px', // Minimal single line height
                          maxHeight: '120px' // Maximum height before scrolling
                        }}
                      />
                      
                      {/* Minimalist save button that appears only when changes are made */}
                      {descriptionChanged && (
                        <div className="absolute right-2 bottom-2 transition-opacity opacity-100">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-3 rounded-full bg-primary text-white hover:bg-primary/90 hover:text-white border-none shadow-sm"
                            onClick={() => {
                              handleSaveDescription();
                            }}
                            disabled={isSaving}
                          >
                            {isSaving ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
          
          <Separator className="my-3" />
          
          {/* GPT Content & Chat Interface - Expanded and prominent */}
          <div className="space-y-4">
            {column.gptAssigned ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-xs font-bold text-green-700">AI</span>
                    </div>
                    <h3 className="font-medium text-gray-800 text-sm">{column.gptName || "AI Assistant"}</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center space-x-2">
                      <History className="h-4 w-4 text-gray-500" />
                      <Label htmlFor="include-chat-history" className="text-xs font-normal text-gray-600">
                        Include chat history
                      </Label>
                      <Switch
                        id="include-chat-history"
                        checked={includeChatHistory}
                        onCheckedChange={handleChatHistoryToggle}
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-xs text-green-700 hover:bg-green-50 border-green-200 h-7 px-2"
                      onClick={handleRetriggerGPT}
                      disabled={rawProcessingStatus}
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      Retrigger
                    </Button>
                  </div>
                </div>
                
                {/* Processing indicator is now completely hidden in the card detail view as per user requirement */}
                {/* <ProcessingIndicator 
                  isProcessing={rawProcessingStatus}
                /> */}
              </>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-gray-500" />
                  <h3 className="font-medium text-gray-700 text-sm">Comments & Attachments</h3>
                </div>
              </div>
            )}
            
            {/* Unified Chat Interface with Output - shown for all columns now */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden">
              <div 
                ref={chatContainerRef}
                className="flex flex-col h-[280px] overflow-y-auto"
              > 
                {/* GPTChat component contains both the message area and the input */}
                <GPTChat 
                  cardId={card.id} 
                  chats={chats} 
                  gptName={column.gptName || "Comments"}
                  gptColor={column.gptColor}
                  embedded={true}
                  finalOutput={gptOutput}
                  isProcessing={rawProcessingStatus}
                  attachments={card.attachments || []}
                />
              </div>
            </div>
            
            {/* Attachments Section - Clear separation and grouping */}
            <div className="mt-4 pt-2 border-t border-gray-100">
              <div className="flex items-center mb-2">
                <div className="flex items-center gap-1.5 flex-1">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-medium mr-2">
                    Attachments {attachments.length > 0 && `(${attachments.length})`}
                  </h3>
                  <div onClick={(e) => e.stopPropagation()}>
                    <FileUpload cardId={card.id} iconOnly={true} />
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col space-y-1 pl-1 mb-3">
                {/* Display existing attachments */}
                {attachments.map((attachment) => (
                  <div key={attachment.id}>
                    <AttachmentItem 
                      attachment={attachment}
                      onDelete={() => {
                        // This will refresh attachments
                        // We rely on the AttachmentItem component to handle the actual deletion
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer Actions - Fixed at bottom */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          {/* Actions on the left */}
          <div className="flex items-center gap-4">
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
            
            {/* Chat history toggle removed from here and moved next to the retrigger button */}
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
