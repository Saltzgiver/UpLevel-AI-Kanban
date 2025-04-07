import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Send, Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chat } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";

interface GPTChatProps {
  cardId: number;
  chats: Chat[];
  gptName: string;
  embedded?: boolean;
  finalOutput?: string | null;
  isProcessing?: boolean;
}

export function GPTChat({ 
  cardId, 
  chats, 
  gptName, 
  embedded = false,
  finalOutput = null,
  isProcessing = false
}: GPTChatProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Track if user has manually scrolled up
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  
  // Handle scroll events to detect manual scrolling
  // Using a ref to track the last scroll position to avoid conflicts with auto-scrolling
  const lastScrollPositionRef = useRef(0);
  const scrollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    // Only set userHasScrolled if this is a genuine user scroll action
    // Compare current scroll with last position to determine if it's likely a user action
    const scrollDelta = Math.abs(scrollTop - lastScrollPositionRef.current);
    if (scrollDelta > 10) { // This helps identify actual user scrolling vs. programmatic
      if (!isScrolledToBottom) {
        setUserHasScrolled(true);
      } else {
        setUserHasScrolled(false);
      }
    }
    
    // Update the last scroll position
    lastScrollPositionRef.current = scrollTop;
    
    // Clear existing timer and set a new one
    if (scrollingTimerRef.current) {
      clearTimeout(scrollingTimerRef.current);
    }
    
    // Reset scrolling state after a brief pause in scrolling
    scrollingTimerRef.current = setTimeout(() => {
      if (isScrolledToBottom) {
        setUserHasScrolled(false);
      }
    }, 100);
  };
  
  // Add scroll event listener
  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);
  
  // Auto-scroll to bottom when messages change, but only in specific cases:
  // 1. When new messages arrive AND user hasn't manually scrolled up
  // 2. When processing state changes (starts or stops)
  // 3. When finalOutput becomes available
  useEffect(() => {
    // Only auto-scroll if one of these conditions is met
    const shouldAutoScroll = 
      !userHasScrolled || // User hasn't scrolled up
      isProcessing ||    // Processing state changed (loading)
      (finalOutput && !prevFinalOutputRef.current); // New final output available
    
    if (chatContainerRef.current && shouldAutoScroll) {
      // Use requestAnimationFrame for smoother scrolling after layout updates
      requestAnimationFrame(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      });
    }
    
    // Track previous finalOutput state to detect changes
    prevFinalOutputRef.current = finalOutput;
  }, [chats, isProcessing, finalOutput, userHasScrolled]);
  
  // Reference to track previous finalOutput status
  const prevFinalOutputRef = useRef(finalOutput);

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    setIsSending(true);
    // Reset user scroll state when sending a new message
    setUserHasScrolled(false);
    
    try {
      await apiRequest("POST", `/api/chats`, {
        cardId,
        role: "user",
        content: message
      });
      
      setMessage("");
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      
      // Force scroll to bottom after sending a message
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      });
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

  // Chat messages component - separated for cleaner structure
  const ChatMessages = () => {
    if (chats.length === 0 && !isProcessing) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-sm text-center text-muted-foreground p-4">
            No messages yet. Ask the AI a question to start the conversation.
          </div>
        </div>
      );
    }
    
    // Find the last assistant message index
    const lastAssistantIndex = chats
      .map((chat, index) => ({ chat, index }))
      .filter(item => item.chat.role === 'assistant')
      .pop()?.index;
    
    // Processing indicator
    const processingIndicator = isProcessing && (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="h-4 w-4 animate-spin text-green-600 mr-2" />
        <span className="text-sm text-green-700">Processing with AI...</span>
      </div>
    );
    
    return (
      <div className="space-y-4 flex flex-col">
        {/* Display processing indicator if applicable */}
        {processingIndicator}
        
        {/* Display all chat messages */}
        {chats.map((chat, index) => {
          // Determine if this is the most recent AI message (for highlighting)
          const isLastAIMessage = chat.role === 'assistant' && index === lastAssistantIndex;
          // Display final output badge only on the last message and if finalOutput is available
          const isOutputMessage = isLastAIMessage && finalOutput && !isProcessing;
          
          return (
            <div key={index} className={`flex flex-col ${chat.role === 'assistant' ? 'items-start' : 'items-end'} max-w-[90%] ${chat.role === 'assistant' ? 'self-start' : 'self-end'}`}>
              <div className="flex items-start">
                {chat.role === 'assistant' && (
                  <div className={`w-6 h-6 rounded-full ${isLastAIMessage ? 'bg-green-500' : 'bg-green-100'} mr-2 flex-shrink-0 flex items-center justify-center`}>
                    {isLastAIMessage ? (
                      <Sparkles className="h-3 w-3 text-white" />
                    ) : (
                      <span className="text-xs font-bold text-green-700">AI</span>
                    )}
                  </div>
                )}
                
                <div className={`text-sm ${
                  chat.role === 'assistant' 
                    ? isLastAIMessage
                      ? 'bg-green-50 text-gray-800 rounded-lg rounded-tl-none border-2 border-green-200' 
                      : 'bg-green-50 text-gray-800 rounded-lg rounded-tl-none border border-green-100'
                    : 'bg-blue-50 text-gray-800 rounded-lg rounded-tr-none border border-blue-100'
                } py-2 px-3 shadow-sm`}>
                  {isOutputMessage && (
                    <div className="flex items-center mb-1">
                      <span className="text-xs font-medium text-green-800 mr-2">Final Output</span>
                      <Badge variant="outline" className="bg-green-100 text-green-800 text-[10px] px-1 py-0 h-4">
                        Moves to next column
                      </Badge>
                    </div>
                  )}
                  {isLastAIMessage && !finalOutput && !isProcessing && (
                    <div className="text-xs font-medium text-green-800 mb-1">Latest AI Response</div>
                  )}
                  {chat.content}
                </div>
                
                {chat.role === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-blue-100 ml-2 flex-shrink-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-700">You</span>
                  </div>
                )}
              </div>
              
              <div className={`text-[10px] ${
                chat.role === 'assistant' 
                  ? isLastAIMessage ? 'text-green-600 font-medium' : 'text-gray-400'
                  : 'text-gray-400'
              } mt-1 px-2 ${
                chat.role === 'assistant' ? 'ml-8' : 'mr-8 text-right'
              }`}>
                {chat.timestamp ? 
                  new Date(chat.timestamp).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}) : 
                  ''}
                {isOutputMessage && (
                  <span className="ml-1 font-medium text-green-600">• Final output</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // If embedded in another component (specifically the card modal), 
  // just return the messages and input without header/container
  if (embedded) {
    return (
      <div className="flex flex-col h-full">
        {/* Scroll indicator - only shown when there is scrollable content and user hasn't scrolled */}
        {chats.length > 3 && !userHasScrolled && (
          <div className="text-center text-xs text-gray-400 animate-pulse mb-1">
            <ChevronUp className="h-3 w-3 mx-auto" />
            Scroll for earlier messages
          </div>
        )}
        
        <div 
          ref={chatContainerRef}
          className="overflow-y-auto px-0 py-2 flex flex-col h-[350px] scroll-smooth"
        >
          <ChatMessages />
        </div>
        
        {/* Chat Input - Always at the bottom */}
        <div className="border-t border-gray-100 p-3 flex items-center gap-2 bg-gray-50/60 sticky bottom-0 z-10 rounded-b-lg">
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
    );
  }

  // Standard standalone component
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
          className="flex-1 overflow-y-auto px-4 py-3 space-y-4 flex flex-col h-[300px] scroll-smooth"
        >
          <ChatMessages />
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
