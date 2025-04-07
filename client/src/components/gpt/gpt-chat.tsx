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
  
  // Using refs to track scroll state between renders without causing re-renders
  const lastScrollPositionRef = useRef(0);
  const scrollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isUserScrollingRef = useRef(false);
  
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    // Get the scroll direction (up or down)
    const isScrollingUp = scrollTop < lastScrollPositionRef.current;
    
    // Only detect intentional scrolling with significant movement
    // This prevents tiny scroll adjustments from triggering the user scroll state
    const scrollDelta = Math.abs(scrollTop - lastScrollPositionRef.current);
    
    // If user is clearly scrolling up (away from bottom), mark as user-scrolled
    if (isScrollingUp && scrollDelta > 20 && !isScrolledToBottom) {
      isUserScrollingRef.current = true;
      setUserHasScrolled(true);
    }
    
    // If at bottom, we can reset the user scrolled state
    if (isScrolledToBottom) {
      setUserHasScrolled(false);
      isUserScrollingRef.current = false;
    }
    
    // Save the position for next comparison
    lastScrollPositionRef.current = scrollTop;
    
    // Debounce the scroll end detection
    if (scrollingTimerRef.current) {
      clearTimeout(scrollingTimerRef.current);
    }
    
    // Only reset scroll state when user has stopped scrolling for a while
    scrollingTimerRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
      
      // When scrolling stops, if at bottom, reset user scroll state
      if (isScrolledToBottom) {
        setUserHasScrolled(false);
      }
    }, 300); // Longer debounce time to prevent interference
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
    // Never auto-scroll while the user is actively scrolling
    if (isUserScrollingRef.current) {
      return;
    }
    
    // Only auto-scroll if one of these conditions is met
    const shouldAutoScroll = 
      !userHasScrolled || // User hasn't scrolled up
      isProcessing ||    // Processing state changed (loading)
      (finalOutput && !prevFinalOutputRef.current); // New final output available
    
    if (chatContainerRef.current && shouldAutoScroll) {
      // Use a small delay to ensure we don't interfere with manual scrolling
      // This helps prevent scroll jittering/jumping
      const timer = setTimeout(() => {
        if (!isUserScrollingRef.current && chatContainerRef.current) {
          // Smooth scroll to bottom instead of instant jump
          chatContainerRef.current.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
      
      return () => clearTimeout(timer);
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
      
      // Scroll to bottom after sending a message
      // Using smooth scroll for better user experience
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
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
      <div className="space-y-6 flex flex-col">
        {/* Display processing indicator if applicable */}
        {processingIndicator}
        
        {/* Display all chat messages */}
        {chats.map((chat, index) => {
          // Determine if this is the most recent AI message (for highlighting)
          const isLastAIMessage = chat.role === 'assistant' && index === lastAssistantIndex;
          // Display final output badge only on the last message and if finalOutput is available
          const isOutputMessage = isLastAIMessage && finalOutput && !isProcessing;
          
          return (
            <div key={index} className={`flex flex-col ${chat.role === 'assistant' ? 'items-start' : 'items-end'} max-w-[90%] ${chat.role === 'assistant' ? 'self-start' : 'self-end'} mb-4`}>
              {/* Message header with pillbox name and time - Slack style */}
              <div className={`flex items-center mb-1 ${chat.role === 'assistant' ? '' : 'justify-end w-full'}`}>
                <div className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  chat.role === 'assistant'
                    ? isLastAIMessage 
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-gray-100 text-gray-800 border border-gray-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}>
                  {chat.role === 'assistant' 
                    ? (isLastAIMessage 
                      ? <span className="flex items-center"><Sparkles className="h-3 w-3 mr-1 text-green-600" /> {gptName}</span>
                      : gptName) 
                    : 'You'}
                </div>
                <div className="text-[10px] text-gray-400 ml-2">
                  {chat.timestamp ? 
                    new Date(chat.timestamp).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}) : 
                    ''}
                </div>
                {isOutputMessage && (
                  <span className="ml-2 text-[10px] font-medium text-green-600 flex items-center">
                    <span className="bg-green-600 rounded-full h-1.5 w-1.5 mr-1"></span>
                    Final output
                  </span>
                )}
              </div>
              
              {/* Message content */}
              <div className="flex items-start ml-2">
                
                {/* Message bubble - user messages keep light blue bubble, GPT messages vary based on rules */}
                <div className={`text-sm ${
                  chat.role === 'assistant' 
                    ? isLastAIMessage
                      ? 'bg-green-50 text-gray-800 rounded-lg rounded-tl-none border-2 border-green-200 py-2 px-3 shadow-sm' 
                      : 'text-gray-800 pl-0 pr-1'  // No bubble for non-latest GPT messages
                    : 'bg-blue-50 text-gray-800 rounded-lg rounded-tr-none border border-blue-100 py-2 px-3 shadow-sm' // User bubble stays the same
                }`}>
                  {isOutputMessage && (
                    <div className="flex items-center mb-1">
                      <Badge variant="outline" className="bg-green-100 text-green-800 text-[10px] px-1 py-0 h-4">
                        Moves to next column
                      </Badge>
                    </div>
                  )}
                  {isLastAIMessage && !finalOutput && !isProcessing && (
                    <div className="text-xs font-medium text-green-800 mb-1">Latest Response</div>
                  )}
                  {chat.content}
                </div>
                
                {/* No user avatar, we're using pillbox names above instead */}
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
          className="overflow-y-auto px-4 py-4 flex flex-col h-[350px] scroll-smooth"
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
          className="flex-1 overflow-y-auto px-4 py-4 space-y-6 flex flex-col h-[300px] scroll-smooth"
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
