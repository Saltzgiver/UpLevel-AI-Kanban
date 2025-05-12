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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FileUpload } from "@/components/ui/file-upload";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Column, Card as CardType, Attachment, Chat } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { GPTChat } from "@/components/gpt/gpt-chat";

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
  // Local state for card details
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || "");
  const [descriptionChanged, setDescriptionChanged] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [includeChatHistory, setIncludeChatHistory] = useState(!!card.includeChatHistory);
  const [isPromptContextExpanded, setIsPromptContextExpanded] = useState(false);
  
  // References
  const modalRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Toast notifications
  const { toast } = useToast();
  
  // Derived state
  const attachments = card.attachments || [];
  const chats = card.chats || [];
  const gptOutput = card.gptOutput || null;
  
  // Tracking status for in-progress GPT tasks 
  const [rawProcessingStatus, setRawProcessingStatus] = useState(false);
  
  // Function to ensure the chat scrolls to the bottom when card modal opens
  useEffect(() => {
    if (!isOpen) return;
    
    // Scroll function for the outer container
    const scrollChatToBottom = () => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        
        // Also try to find any inner scroll containers and scroll them
        // Specifically target our chat message container
        const chatMessageContainers = chatContainerRef.current.querySelectorAll('.chat-message-container');
        chatMessageContainers.forEach(container => {
          if (container instanceof HTMLElement) {
            console.log('Scrolling chat message container to bottom:', container.scrollHeight);
            container.scrollTop = container.scrollHeight;
          }
        });
      }
    };
    
    // Execute with multiple attempts to catch rendering delays
    // Start with immediate scroll
    scrollChatToBottom();
    
    // Then multiple delayed scrolls with increasing timeouts
    const timers = [
      setTimeout(scrollChatToBottom, 50),
      setTimeout(scrollChatToBottom, 150),
      setTimeout(scrollChatToBottom, 300),
      setTimeout(scrollChatToBottom, 500),
      setTimeout(scrollChatToBottom, 800)  // Extra long timeout for slower renderings
    ];
    
    return () => {
      // Clean up timers
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [isOpen, card.id, chats.length]); // Re-run when modal opens, card changes, or chat messages change
  
  // Poll for status updates when a card is being processed by GPT
  useEffect(() => {
    if (!column.gptAssigned) return;
    
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/cards/${card.id}/processing-status`);
        const data = await response.json();
        setRawProcessingStatus(!!data.processing);
      } catch (error) {
        console.error("Error checking processing status:", error);
      }
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 1000);
    
    return () => clearInterval(interval);
  }, [card.id, column.gptAssigned]);
  
  // Save title if it's changed
  const handleSaveTitle = async () => {
    if (title === card.title || title.trim() === "") return;
    
    setIsSaving(true);
    try {
      await apiRequest('PATCH', `/api/cards/${card.id}`, { title });
      toast({
        title: "Title updated",
        description: "The card title has been saved.",
      });
    } catch (error) {
      console.error("Error saving title:", error);
      toast({
        title: "Error saving title",
        description: "There was a problem saving the card title.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Save description if it's changed
  const handleSaveDescription = async () => {
    if (description === (card.description || "")) return;
    
    setIsSaving(true);
    try {
      await apiRequest('PATCH', `/api/cards/${card.id}`, { description });
      toast({
        title: "Context updated",
        description: "The prompt context has been saved.",
      });
      setDescriptionChanged(false);
    } catch (error) {
      console.error("Error saving description:", error);
      toast({
        title: "Error saving context",
        description: "There was a problem saving the prompt context.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Retrigger GPT processing for the card
  const handleRetriggerGPT = async () => {
    if (!column.gptAssigned || rawProcessingStatus) return;
    
    try {
      await apiRequest('POST', `/api/cards/${card.id}/trigger-gpt`);
      toast({
        title: "AI processing retriggered",
        description: "The AI will process this card again.",
      });
    } catch (error) {
      console.error("Error retriggering GPT:", error);
      toast({
        title: "Error retriggering AI",
        description: "There was a problem retriggering the AI processing.",
        variant: "destructive",
      });
    }
  };
  
  // Handle delete card action
  const handleDelete = async () => {
    if (isDeleting) return;
    
    if (window.confirm(`Are you sure you want to delete this card: "${card.title}"?`)) {
      setIsDeleting(true);
      try {
        await apiRequest('DELETE', `/api/cards/${card.id}`);
        onDelete(card.id);
        onClose();
      } catch (error) {
        console.error("Error deleting card:", error);
        toast({
          title: "Error deleting card",
          description: "There was a problem deleting the card.",
          variant: "destructive",
        });
        setIsDeleting(false);
      }
    }
  };
  
  // Handle including chat history toggle
  const handleChatHistoryToggle = async (checked: boolean) => {
    if (checked === !!card.includeChatHistory) return;
    
    try {
      await apiRequest('PATCH', `/api/cards/${card.id}`, { includeChatHistory: !checked });
      setIncludeChatHistory(!checked);
    } catch (error) {
      console.error("Error toggling chat history:", error);
      toast({
        title: "Error updating setting",
        description: "There was a problem updating the chat history setting.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 overflow-hidden p-4">
      <div 
        ref={modalRef}
        className="bg-white rounded-xl w-full max-w-5xl h-[85vh] overflow-hidden flex flex-col shadow-xl"
      >
        {/* === FIXED HEADER SECTION - Always visible === */}
        <div className="flex-shrink-0">
          {/* Top header with title and column badge */}
          <div className="px-6 py-3 border-b border-gray-100 flex justify-between items-center bg-white z-10">
            <div className="flex-1 flex items-center gap-2 overflow-hidden">
              <input 
                className="flex-1 text-xl font-medium bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-transparent overflow-hidden py-0 px-0" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleSaveTitle}
              />
              <Badge variant="outline" className="text-xs font-normal py-0 h-5 bg-gray-50 flex-shrink-0">
                {column.name}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full flex-shrink-0" onClick={onClose}>
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
        </div>
        
        {/* === PROMPT CONTEXT SECTION - Collapsible, stays at top === */}
        <div className="flex-shrink-0 px-6 pt-2 bg-white">
          <Collapsible className="mb-1" open={isPromptContextExpanded} onOpenChange={setIsPromptContextExpanded}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <div className="flex items-center gap-2 hover:bg-gray-50 p-1 rounded-md cursor-pointer w-full">
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
              <div className="pl-6 pb-2">
                <div className={`rounded-md ${
                  description ? 
                    'border border-gray-200 bg-gray-50/50' : 
                    'border border-dashed border-gray-200 hover:border-gray-300'
                }`}>
                  <div 
                    className="min-h-0 w-full relative"
                    onClick={(e) => {
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
                          setDescriptionChanged(e.target.value !== (card.description || ""));
                          e.target.style.height = '24px';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        placeholder="Add context for the AI to understand your task..."
                      />
                    </div>
                  </div>
                </div>
                
                {descriptionChanged && (
                  <div className="flex justify-end mt-2">
                    <Button 
                      size="sm"
                      className="h-7 px-3 rounded-full bg-primary text-white hover:bg-primary/90 hover:text-white border-none shadow-sm"
                      onClick={handleSaveDescription}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        
        {/* === AI CHAT HEADER - Fixed, always visible === */}
        <div className="flex-shrink-0 px-6 py-2 bg-white border-t border-b border-gray-100 z-10">
          {column.gptAssigned ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-green-700">AI</span>
                </div>
                <h3 className="font-medium text-gray-800 text-sm">{column.gptName || "AI Assistant"}</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
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
          ) : (
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-gray-500" />
                <h3 className="font-medium text-gray-700 text-sm">Comments & Attachments</h3>
              </div>
            </div>
          )}
        </div>
        
        {/* === CHAT CONTENT AREA - Scrollable === */}
        <div className="overflow-y-auto flex-grow px-6 py-2 flex flex-col">
          {/* Unified Chat Interface with Output */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col flex-grow overflow-hidden">
            <div 
              ref={chatContainerRef}
              className="flex flex-col flex-grow overflow-y-auto"
            > 
              {/* GPTChat component contains the message area */}
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
        </div>
        
        {/* === FIXED FOOTER - Always visible === */}
        <div className="flex-shrink-0 px-6 pt-2 pb-3 bg-white border-t border-gray-100 mt-2">
          {/* Attachments Section - Compact spacing */}
          <div className="mb-1">
            <div className="flex items-center mb-1">
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
            
            <div className="flex flex-col space-y-1 pl-1 mb-2">
              {attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={`/api/files/${attachment.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                >
                  <FileText className="h-3 w-3" />
                  {attachment.filename}
                </a>
              ))}
            </div>
          </div>
          
          {/* Card Action Buttons */}
          <div className="flex justify-between items-center pt-1 border-t border-gray-100">
            {/* Move to column dropdown */}
            <div className="flex items-center space-x-3">
              <div className="relative inline-block text-left">
                <select
                  value={column.id}
                  onChange={(e) => {
                    const destId = parseInt(e.target.value);
                    if (destId !== column.id) {
                      onMove(card.id, column.id, destId);
                      onClose();
                    }
                  }}
                  className="text-xs text-gray-700 bg-white border border-gray-200 rounded-md px-2 py-1 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={column.id}>Move to...</option>
                  {columns
                    .filter((c) => c.id !== column.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
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
    </div>
  );
}