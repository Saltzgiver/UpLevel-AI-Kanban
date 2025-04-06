import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chat } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface GPTChatProps {
  cardId: number;
  chats: Chat[];
  gptName: string;
}

export function GPTChat({ cardId, chats, gptName }: GPTChatProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chats]);

  // Format timestamp into readable time
  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return "";
    
    try {
      const date = new Date(timestamp);
      return format(date, "h:mm a" as const);
    } catch (error) {
      return "";
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    setIsSending(true);
    
    try {
      await apiRequest("POST", `/api/chats`, {
        cardId,
        role: "user",
        content: message
      });
      
      setMessage("");
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="text-sm font-medium text-gray-700">
          Conversation with {gptName || 'AI Assistant'}
        </div>
      </div>
      
      <div className="flex flex-col">
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-4 flex flex-col min-h-[240px] max-h-[300px]"
        >
          {chats.length === 0 ? (
            <div className="text-sm text-center text-muted-foreground p-4 mt-auto">
              No messages yet. Ask the AI a question to start the conversation.
            </div>
          ) : (
            <div className="space-y-4 mt-auto">
              {chats.map((chat, index) => (
                <div key={index} className={`flex flex-col ${chat.role === 'assistant' ? 'items-start' : 'items-end'} max-w-[90%] ${chat.role === 'assistant' ? 'self-start' : 'self-end'}`}>
                  <div className="flex items-start">
                    {chat.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full bg-green-100 mr-2 flex-shrink-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-green-700">AI</span>
                      </div>
                    )}
                    
                    <div className={`text-sm ${
                      chat.role === 'assistant' 
                        ? 'bg-green-50 text-gray-800 rounded-lg rounded-tl-none border border-green-100' 
                        : 'bg-blue-50 text-gray-800 rounded-lg rounded-tr-none border border-blue-100'
                    } py-2 px-3 shadow-sm`}>
                      {chat.content}
                    </div>
                    
                    {chat.role === 'user' && (
                      <div className="w-6 h-6 rounded-full bg-blue-100 ml-2 flex-shrink-0 flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-700">You</span>
                      </div>
                    )}
                  </div>
                  
                  <div className={`text-[10px] text-gray-400 mt-1 px-2 ${
                    chat.role === 'assistant' ? 'ml-8' : 'mr-8 text-right'
                  }`}>
                    {chat.timestamp ? formatTime(chat.timestamp) : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Chat Input - Fixed at the bottom */}
        <div className="border-t border-gray-100 p-3 flex items-center gap-2 bg-gray-50/60">
          <Input
            type="text"
            placeholder={`Ask ${gptName || 'AI'} a question...`}
            className="text-sm border-gray-200 focus:border-gray-300 focus:ring-gray-200 rounded-full"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isSending}
          />
          <Button
            size="sm"
            className={`rounded-full p-2 h-9 w-9 flex-shrink-0 ${
              isSending 
                ? 'bg-gray-300 text-gray-600' 
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
            onClick={handleSendMessage}
            disabled={isSending}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
