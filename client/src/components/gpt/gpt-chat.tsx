import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Send } from "lucide-react";
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
  const [showChat, setShowChat] = useState(true);
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
      return format(date, "h:mm a");
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
    <div className="mt-2">
      <Button
        variant="ghost"
        className="flex items-center p-0 h-auto mb-1 text-xs font-medium text-muted-foreground"
        onClick={() => setShowChat(!showChat)}
      >
        <span>Chat with {gptName || 'GPT'}:</span>
        {showChat ? (
          <ChevronUp className="h-4 w-4 ml-1" />
        ) : (
          <ChevronDown className="h-4 w-4 ml-1" />
        )}
      </Button>
      
      {showChat && (
        <div className="border border-border rounded bg-white flex flex-col h-64">
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-2 space-y-2 flex flex-col"
          >
            {chats.length === 0 ? (
              <div className="text-xs text-center text-muted-foreground py-2 mt-auto">
                No messages yet. Start the conversation!
              </div>
            ) : (
              <div className="space-y-3 mt-auto">
                {chats.map((chat, index) => (
                  <div key={index} className={`flex flex-col ${chat.role === 'assistant' ? 'items-start' : 'items-end'}`}>
                    <div className="flex items-start max-w-[90%]">
                      {chat.role === 'assistant' && (
                        <div className="w-6 h-6 rounded-full bg-green-100 mr-2 flex-shrink-0 flex items-center justify-center">
                          <span className="text-xs font-bold text-green-700">G</span>
                        </div>
                      )}
                      
                      <div className={`text-sm ${
                        chat.role === 'assistant' 
                          ? 'bg-green-50 text-gray-800 rounded-md rounded-tl-none' 
                          : 'bg-blue-50 text-gray-800 rounded-md rounded-tr-none'
                      } p-2 relative`}>
                        {chat.content}
                      </div>
                      
                      {chat.role === 'user' && (
                        <div className="w-6 h-6 rounded-full bg-blue-100 ml-2 flex-shrink-0 flex items-center justify-center">
                          <span className="text-xs font-bold text-blue-700">U</span>
                        </div>
                      )}
                    </div>
                    
                    <div className={`text-[10px] text-gray-400 mt-1 px-2 ${
                      chat.role === 'assistant' ? 'ml-8' : 'mr-8 text-right'
                    }`}>
                      {formatTime(chat.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Chat Input */}
          <div className="border-t border-border p-2 flex items-center">
            <Input
              type="text"
              placeholder={`Message ${gptName || 'GPT'}...`}
              className="text-sm"
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
              size="icon"
              className="ml-2 bg-green-600 text-white rounded p-1.5 flex-shrink-0 hover:bg-green-700 h-8 w-8"
              onClick={handleSendMessage}
              disabled={isSending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
