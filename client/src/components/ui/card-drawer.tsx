import React, { useState, useEffect, useRef } from "react";
import { 
  Drawer, 
  DrawerContent, 
  DrawerDescription,
  DrawerFooter, 
  DrawerHeader,
  DrawerTitle,
  DrawerClose 
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCardProcessing } from "@/hooks/use-card-processing";
import { X, ChevronDown, ArrowRight, RotateCw, Trash2, Menu, Loader2, AlertTriangle } from "lucide-react";
import { GPTChat } from "@/components/gpt/gpt-chat";
import { Card as CardType, Column, Chat, Attachment } from "@shared/schema";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AttachmentItem } from "@/components/gpt/attachment-item";

interface CardDrawerProps {
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

export function CardDrawer({ 
  card, 
  column, 
  columns,
  isOpen, 
  onClose, 
  onDelete,
  onMove
}: CardDrawerProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || "");
  const [includeChatHistory, setIncludeChatHistory] = useState(card.includeChatHistory || false);
  const [isSaving, setIsSaving] = useState(false);
  const [showMoveOptions, setShowMoveOptions] = useState(false);
  const [descriptionChanged, setDescriptionChanged] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();
  
  // Get real-time processing status with more frequent polling for chat messages
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

  // Initialize state when the drawer opens
  useEffect(() => {
    if (isOpen) {
      setTitle(card.title);
      setDescription(card.description || "");
      setIncludeChatHistory(card.includeChatHistory || false);
      setShowMoveOptions(false);
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

  const handleIncludeChatHistoryChange = async (value: boolean) => {
    if (value === card.includeChatHistory) return;
    
    try {
      await apiRequest("PATCH", `/api/cards/${card.id}`, { includeChatHistory: value });
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      // Update the local state
      setIncludeChatHistory(value);
      card.includeChatHistory = value;
      toast({
        title: "Success",
        description: value 
          ? "AI will now use chat history for context" 
          : "AI will not use chat history for context",
      });
    } catch (error) {
      // Revert the local state on error
      setIncludeChatHistory(card.includeChatHistory || false);
      toast({
        title: "Error",
        description: "Failed to update chat history setting",
        variant: "destructive",
      });
    }
  };

  const handleMoveCard = (destinationColumnId: number) => {
    onMove(card.id, column.id, destinationColumnId);
    setShowMoveOptions(false);
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

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    setShowDeleteConfirm(false);
    onDelete(card.id);
    onClose();
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent 
          className="max-h-[95vh] h-[95vh] outline-none focus:outline-none pt-0"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}>
          {/* Custom drawer handle with less margin */}
          <div className="mx-auto mt-1 h-1 w-[100px] rounded-full bg-muted" />
          <div className="mx-auto w-full max-w-4xl">
            <DrawerHeader className="px-6 pt-1 pb-1">
              <DrawerTitle className="sr-only">Card Details</DrawerTitle>
              <DrawerDescription className="sr-only">
                View and edit card details, description, and AI conversation
              </DrawerDescription>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex-grow">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-normal py-0 h-5 bg-gray-50 whitespace-nowrap">
                          {column.name}
                        </Badge>
                        <input 
                          className="text-xl font-medium bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-transparent" 
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          onBlur={handleSaveTitle}
                          aria-label="Card title"
                        />
                      </div>
                    </div>
                  </div>
                  <DrawerClose className="rounded-full">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </DrawerClose>
                </div>
                
                {/* Save title button appears if title is edited */}
                {title !== card.title && (
                  <div className="flex justify-end mt-1">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={handleSaveTitle}
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Title"}
                    </Button>
                  </div>
                )}
              </div>
            </DrawerHeader>
            
            <div className="px-6 pb-6 overflow-y-auto space-y-6 max-h-[calc(95vh-4rem)]">
              {/* Description Section */}
              <div className="space-y-2">
                <div className="font-medium text-sm text-gray-500">Description</div>
                <Textarea
                  ref={textAreaRef}
                  placeholder="Add a description..."
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setDescriptionChanged(e.target.value !== card.description);
                    if (textAreaRef.current) {
                      textAreaRef.current.style.height = '24px';
                      textAreaRef.current.style.height = textAreaRef.current.scrollHeight + 'px';
                    }
                  }}
                  className="min-h-[100px] resize-none"
                />
                
                {/* Save description button appears if description is edited */}
                {descriptionChanged && (
                  <div className="flex justify-end">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={handleSaveDescription}
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Description"}
                    </Button>
                  </div>
                )}
              </div>
              
              <Separator />
              
              {/* Card Actions */}
              <div className="space-y-2">
                <div className="font-medium text-sm text-gray-500">Card Actions</div>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-xs"
                    onClick={() => setShowMoveOptions(!showMoveOptions)}
                  >
                    <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                    Move Card
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-xs"
                    onClick={handleRetriggerGPT}
                  >
                    <RotateCw className="h-3.5 w-3.5 mr-1.5" />
                    Regenerate
                  </Button>
                  
                  {/* Reset processing button - only show it when needed */}
                  {(isProcessing || isProcessingTimedOut || processingError) && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-xs text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                      onClick={handleResetProcessing}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                      Reset Processing
                    </Button>
                  )}
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-xs text-red-600 border-red-300 hover:bg-red-50"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Delete Card
                  </Button>
                </div>
                
                {/* Move column options */}
                {showMoveOptions && (
                  <div className="mt-2 bg-gray-50 p-3 rounded-md">
                    <div className="text-xs font-medium mb-2">Move to column:</div>
                    <div className="grid grid-cols-2 gap-2">
                      {columns.map((col) => (
                        <Button
                          key={col.id}
                          variant="ghost"
                          size="sm"
                          className={`text-xs justify-start ${
                            col.id === column.id ? "bg-gray-200 pointer-events-none" : ""
                          }`}
                          disabled={col.id === column.id}
                          onClick={() => handleMoveCard(col.id)}
                        >
                          {col.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <Separator />
              
              {/* Attachments Section - if there are any */}
              {attachments && attachments.length > 0 && (
                <>
                  <div className="space-y-2">
                    <div className="font-medium text-sm text-gray-500">Attachments</div>
                    <div className="flex flex-col space-y-1">
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
                  <Separator />
                </>
              )}
              
              {/* Chat Settings */}
              <div className="space-y-2">
                <div className="font-medium text-sm text-gray-500">Chat Settings</div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="include-chat-history"
                    checked={includeChatHistory}
                    onCheckedChange={handleIncludeChatHistoryChange}
                  />
                  <Label htmlFor="include-chat-history">Include chat history in AI context</Label>
                </div>
              </div>
              
              <Separator />
              
              {/* GPT Chat Section */}
              <div className="space-y-2" ref={chatContainerRef}>
                <div className="font-medium text-sm text-gray-500">AI Conversation</div>
                <GPTChat
                  cardId={card.id}
                  chats={chats || []}
                  gptName={column.gptName || "AI Assistant"}
                  gptColor={column.gptColor || ""}
                  finalOutput={gptOutput}
                  isProcessing={isProcessing}
                  attachments={attachments}
                />
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
      
      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Card"
        description="Are you sure you want to delete this card? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}