import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Send, Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chat } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Define color palette
type ColorName = "Peach" | "Sky" | "Lavender" | "Mint" | "Aqua";

type ColorStyles = {
  bg: string;
  text: string;
  border: string;
};

const colorPalette: Record<ColorName, ColorStyles> = {
  "Peach": { bg: "bg-[#FEE9D7]", text: "text-[#E25B3D]", border: "border-[#F7C9B0]" },
  "Sky": { bg: "bg-[#E1F2FE]", text: "text-[#2E7EC9]", border: "border-[#B7DCF7]" }, 
  "Lavender": { bg: "bg-[#F6E6FF]", text: "text-[#C235D1]", border: "border-[#E9CEFB]" },
  "Mint": { bg: "bg-[#DDFFE7]", text: "text-[#1A9E5E]", border: "border-[#C1EDD4]" },
  "Aqua": { bg: "bg-[#E0F9FF]", text: "text-[#3992B0]", border: "border-[#C3E8F4]" }
};

interface GPTChatProps {
  cardId: number;
  chats: Chat[];
  gptName: string;
  gptColor?: string | null;
  embedded?: boolean;
  finalOutput?: string | null;
  isProcessing?: boolean;
}

// Helper to safely get color styles
const getColorStyle = (colorName: string | null | undefined, defaultColor: ColorName = "Peach"): ColorStyles => {
  if (colorName && colorName in colorPalette) {
    return colorPalette[colorName as ColorName];
  }
  return colorPalette[defaultColor];
};

export function GPTChat({ 
  cardId, 
  chats, 
  gptName, 
  gptColor = "Peach" as ColorName,
  embedded = false,
  finalOutput = null,
  isProcessing = false
}: GPTChatProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Track if this is the initial render to force scroll to bottom
  const isInitialRenderRef = useRef(true);
  // Track if chat messages have changed to force scroll to bottom on new messages
  const prevChatsLengthRef = useRef(chats?.length || 0);

  // Simplified scroll behavior function
  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    if (chatContainerRef.current) {
      // Log some details about scrolling for debugging
      console.log("Scroll effect triggered, chats length:", chats.length);
      
      if (isInitialRenderRef.current) {
        console.log("Forcing scroll to absolute bottom");
        // Set the scroll position directly for most reliable first-render behavior
        const container = chatContainerRef.current;
        console.log("Container: scrollHeight=", container.scrollHeight, "clientHeight=", container.clientHeight);
        
        // Using RAF to ensure the DOM has updated before scrolling
        requestAnimationFrame(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
        });
        
        isInitialRenderRef.current = false;
      } else {
        // For subsequent scrolls, use smooth behavior
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior
        });
      }
    }
  };
  
  // Scroll to bottom on initial render
  useEffect(() => {
    // Use a slightly longer delay to ensure content is fully rendered
    const timer = setTimeout(() => {
      scrollToBottom('auto');
    }, 150);
    return () => clearTimeout(timer);
  }, []);
  
  // Scroll to bottom when new messages arrive or when processing state changes
  useEffect(() => {
    // Check if we have new messages
    const hasNewMessages = chats.length > prevChatsLengthRef.current;
    prevChatsLengthRef.current = chats.length;
    
    // Always scroll to bottom when:
    // 1. New messages arrive
    // 2. Processing state changes
    // 3. Final output becomes available
    if (hasNewMessages || isProcessing !== undefined || finalOutput) {
      // Use a small timeout to ensure DOM has updated
      setTimeout(() => {
        scrollToBottom('smooth');
      }, 100);
    }
  }, [chats, isProcessing, finalOutput]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    setIsSending(true);
    // Use scrollToBottom to scroll to the latest message after sending
    scrollToBottom('smooth');

    try {
      // Store a copy of the message text before clearing the input
      const sentMessage = message.trim();

      // Create a local optimistic update with the new message
      const optimisticChat = {
        id: Date.now(), // Temporary ID
        cardId,
        role: "user",
        content: sentMessage,
        timestamp: new Date().toISOString()
      };

      // Clear the input field immediately for better UX
      setMessage("");

      // Send the message to the server
      await apiRequest("POST", `/api/chats`, {
        cardId,
        role: "user",
        content: sentMessage
      });

      // Start polling for processing status to get new messages
      queryClient.invalidateQueries({ queryKey: [`/api/cards/${cardId}/processing-status`] });
      // Also update the board data
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      
      // We already called scrollToBottom at the start, no need to scroll again
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

    // Determine if we should show processing indicator
    // Hide it if we already have a final output (could be stuck in processing state)
    const shouldShowProcessing = isProcessing && !finalOutput;

    // Processing indicator
    const processingIndicator = shouldShowProcessing && (
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
          // Note: we show the output even if isProcessing is true (it might be stuck in that state)
          const isOutputMessage = isLastAIMessage && finalOutput;

          return (
            <div key={index} className={`flex flex-col ${chat.role === 'assistant' ? 'items-start' : 'items-end'} max-w-[90%] ${chat.role === 'assistant' ? 'self-start' : 'self-end'} mb-4`}>
              {/* Message header with pillbox name and time - Slack style */}
              <div className={`flex items-center mb-1 ${chat.role === 'assistant' ? '' : 'justify-end w-full'}`}>
                <div className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  chat.role === 'assistant'
                    ? isLastAIMessage 
                      ? `${getColorStyle(gptColor).bg} ${getColorStyle(gptColor).text} ${getColorStyle(gptColor).border}`
                      : 'bg-gray-100 text-gray-800 border border-gray-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}>
                  {chat.role === 'assistant' 
                    ? (isLastAIMessage 
                      ? <span className="flex items-center"><Sparkles className={`h-3 w-3 mr-1 ${getColorStyle(gptColor).text}`} /> {gptName}</span>
                      : gptName) 
                    : 'You'}
                </div>
                <div className="text-[10px] text-gray-400 ml-2">
                  {chat.timestamp ? 
                    new Date(chat.timestamp).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}) : 
                    ''}
                </div>

              </div>

              {/* Message content */}
              <div className="flex items-start ml-2">

                {/* Message bubble - user messages keep light blue bubble, GPT messages vary based on rules */}
                <div className={`text-sm ${
                  chat.role === 'assistant' 
                    ? isLastAIMessage
                      ? `${getColorStyle(gptColor).bg} text-gray-800 rounded-lg rounded-tl-none border-2 ${getColorStyle(gptColor).border} py-2 px-3 shadow-sm` 
                      : 'text-gray-800 pl-0 pr-1'  // No bubble for non-latest GPT messages
                    : 'bg-blue-50 text-gray-800 rounded-lg rounded-tr-none border border-blue-100 py-2 px-3 shadow-sm' // User bubble stays the same
                }`}>

                  {isLastAIMessage && (finalOutput || (!isProcessing && chat.content)) && (
                    <div className="flex items-center mb-2 mt-1">
                      <span className="text-xs font-medium text-green-800">Latest Response</span>
                    </div>
                  )}
                  {chat.role === 'assistant' ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: (props: any) => <p className="my-0.5 text-xs" {...props} />,
                        ul: (props: any) => <ul className="list-disc pl-3 my-0.5 text-xs" {...props} />,
                        ol: (props: any) => <ol className="list-decimal pl-3 my-0.5 text-xs" {...props} />,
                        li: (props: any) => <li className="my-0 text-xs" {...props} />,
                        a: (props: any) => <a className="text-blue-600 hover:underline text-xs" {...props} />,
                        blockquote: (props: any) => <blockquote className="border-l-2 border-gray-300 pl-2 my-0.5 text-xs" {...props} />,
                        code: (props: any) => 
                          props.inline 
                            ? <code className="bg-gray-100 px-0.5 rounded text-[10px] font-mono" {...props} />
                            : <code className="block bg-gray-100 p-1 rounded text-[10px] font-mono my-0.5 overflow-x-auto" {...props} />,
                        pre: (props: any) => <pre className="bg-gray-100 p-1 rounded text-[10px] font-mono my-0.5 overflow-x-auto" {...props} />,
                        strong: (props: any) => <strong className="font-bold text-xs" {...props} />,
                        em: (props: any) => <em className="italic text-xs" {...props} />,
                      }}
                    >
                      {chat.content}
                    </ReactMarkdown>
                  ) : (
                    <div>{chat.content}</div>
                  )}
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
        {/* Chat container with fixed height to ensure scrolling works */}
        <div 
          ref={chatContainerRef}
          className="overflow-y-auto px-4 py-4 flex flex-col scroll-smooth"
          style={{ 
            // Fixed height to ensure scrolling is possible
            height: "350px",
            maxHeight: "350px",
            // Add a subtle scrollbar indicator that doesn't take space
            scrollbarWidth: "thin",
            scrollbarColor: "#E5E7EB transparent"
          }}
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