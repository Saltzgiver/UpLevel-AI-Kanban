import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  X, FileText, Users, Paperclip, Calendar, 
  Zap, Settings, Copy, Move, Trash2, MessageSquare 
} from "lucide-react";
import { GPTOutput } from "@/components/gpt/gpt-output";
import { GPTChat } from "@/components/gpt/gpt-chat";
import { AttachmentItem } from "@/components/gpt/attachment-item";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Card as CardType, Column, Chat, Attachment } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        ref={modalRef}
        className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-trello-border flex justify-between items-start">
          <div className="flex-1 pr-4">
            <div className="flex items-center mb-2">
              <FileText className="h-5 w-5 text-muted-foreground mr-2" />
              <Textarea 
                className="w-full text-lg font-medium bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none overflow-hidden" 
                rows={1}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleSaveTitle}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              In list <span className="underline cursor-pointer">{column.name}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-6 w-6" />
          </Button>
        </div>
        
        {/* Modal Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {/* Card Description */}
          <div className="mb-6">
            <div className="flex items-center mb-2">
              <FileText className="h-5 w-5 text-muted-foreground mr-2" />
              <h3 className="text-sm font-medium">Description</h3>
            </div>
            <div className="pl-7">
              <Textarea
                className="text-sm text-foreground min-h-[80px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleSaveDescription}
                placeholder="Add a more detailed description..."
              />
            </div>
          </div>
          
          {/* GPT Content */}
          {column.gptAssigned && (
            <div className="mb-6 bg-gray-50 rounded-md p-3 border border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center mr-2">
                    <span className="text-xs font-bold text-green-700">G</span>
                  </div>
                  <h3 className="text-sm font-medium">{column.gptName} Output</h3>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-xs text-green-700 bg-green-50 hover:bg-green-100 border-green-200"
                  onClick={handleRetriggerGPT}
                  disabled={!!card.processing}
                >
                  <Zap className="h-3 w-3 mr-1" />
                  Retrigger
                </Button>
              </div>
              
              {!!card.processing ? (
                <div className="flex items-center justify-center p-4">
                  <div className="flex items-center text-yellow-700">
                    <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    GPT is processing...
                  </div>
                </div>
              ) : (
                <GPTOutput 
                  output={card.gptOutput} 
                  attachments={card.attachments || []} 
                />
              )}
              
              {/* Chat Interface */}
              <GPTChat 
                cardId={card.id} 
                chats={card.chats || []} 
                gptName={column.gptName || ""}
              />
            </div>
          )}
          
          <div className="flex items-center justify-end gap-2 mt-4">
            <div className="relative mr-auto">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-sm"
                onClick={() => setShowMoveOptions(!showMoveOptions)}
              >
                <Move className="h-4 w-4 mr-2" />
                Move
              </Button>
              
              {showMoveOptions && (
                <div className="absolute top-full left-0 bg-white shadow-lg rounded-md border border-border z-10 mt-1 w-48">
                  <div className="p-2">
                    <div className="text-xs font-medium mb-2">Move to column:</div>
                    {columns.map((col) => (
                      <div 
                        key={col.id} 
                        className={`
                          text-sm p-2 rounded cursor-pointer hover:bg-gray-100
                          ${col.id === column.id ? 'bg-gray-100 text-muted-foreground' : ''}
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
            
            <Button 
              variant="ghost" 
              size="sm"
              className="text-sm text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
