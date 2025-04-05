import { useState } from "react";
import { ChevronDown, ChevronUp, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chat } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface GPTChatProps {
  cardId: number;
  chats: Chat[];
  gptName: string;
}

export function GPTChat({ cardId, chats, gptName }: GPTChatProps) {
  const [showChat, setShowChat] = useState(true);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

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
        <span>Chat with GPT:</span>
        {showChat ? (
          <ChevronUp className="h-4 w-4 ml-1" />
        ) : (
          <ChevronDown className="h-4 w-4 ml-1" />
        )}
      </Button>
      
      {showChat && (
        <div className="border border-border rounded bg-white">
          <div className="max-h-48 overflow-y-auto p-2 space-y-2">
            {chats.length === 0 ? (
              <div className="text-xs text-center text-muted-foreground py-2">
                No messages yet. Start the conversation!
              </div>
            ) : (
              chats.map((chat, index) => (
                <div key={index} className={`flex ${chat.role === 'assistant' ? '' : 'justify-end'}`}>
                  <div className={`w-6 h-6 rounded-full ${
                    chat.role === 'assistant' ? 'bg-green-100 mr-2' : 'bg-blue-100 ml-2 order-last'
                  } flex-shrink-0 flex items-center justify-center`}>
                    <span className={`text-xs font-bold ${
                      chat.role === 'assistant' ? 'text-green-700' : 'text-blue-700'
                    }`}>
                      {chat.role === 'assistant' ? 'G' : 'U'}
                    </span>
                  </div>
                  <div className={`text-sm text-foreground ${
                    chat.role === 'assistant' 
                      ? 'bg-green-50 p-2 rounded-md rounded-tl-none' 
                      : 'bg-blue-50 p-2 rounded-md rounded-tr-none'
                  } max-w-[85%]`}>
                    {chat.content}
                  </div>
                </div>
              ))
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
