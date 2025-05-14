import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Send, Loader2, Sparkles, X, Maximize2, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chat, Attachment } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TypingIndicator } from "./typing-indicator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
// Define image request patterns locally
// These patterns should match what's used on the server
const imageRequestPatterns = [
  /create (?:an|a) image/i,
  /generate (?:an|a) image/i,
  /make (?:an|a) image/i,
  /draw (?:an|a) image/i,
  /create (?:an|a) picture/i,
  /generate (?:an|a) picture/i,
  /make (?:an|a) picture/i,
  /draw (?:an|a) picture/i,
  /show me (?:an|a) image/i,
  /can you create (?:an|a) image/i,
  /image of/i,
  /picture of/i,
  /visualization of/i,
  // Add more explicit patterns to ensure we catch all image generation requests
  /new image/i,
  /another image/i,
  /create image/i,
  /generate image/i
];

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
  attachments?: Attachment[];
}

// Helper to safely get color styles
const getColorStyle = (colorName: string | null | undefined, defaultColor: ColorName = "Peach"): ColorStyles => {
  if (colorName && colorName in colorPalette) {
    return colorPalette[colorName as ColorName];
  }
  return colorPalette[defaultColor];
};

// Placeholder Image Dialog Modal Component (not used until image functionality is reimplemented)
function ImageDialogModal({ 
  selectedImage, 
  setSelectedImage 
}: { 
  selectedImage: {src: string, alt: string} | null, 
  setSelectedImage: (image: {src: string, alt: string} | null) => void 
}) {
  // This component is currently disabled as part of image functionality removal
  // It will be reimplemented in the future
  return null;
}

export function GPTChat({ 
  cardId, 
  chats, 
  gptName, 
  gptColor = "Peach" as ColorName,
  embedded = false,
  finalOutput = null,
  isProcessing = false,
  attachments = []
}: GPTChatProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{src: string, alt: string} | null>(null);
  // Add forceShowTyping state at this level so it can be shared between handleSendMessage and the ChatMessages
  const [forceShowTyping, setForceShowTyping] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
  
  // Scroll to bottom function - used in multiple places
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  // Initial scroll to bottom when component mounts and when messages change
  useEffect(() => {
    // For embedded view (in card modal), we want to be aggressive about scrolling to bottom
    if (embedded) {
      // Immediate scroll
      scrollToBottom();
      
      // Multiple delayed scrolls to catch any content that renders late
      const timers = [
        setTimeout(scrollToBottom, 50),
        setTimeout(scrollToBottom, 150),
        setTimeout(scrollToBottom, 300),
        setTimeout(scrollToBottom, 500),  // Extra long timeout just in case
      ];
      
      return () => {
        // Clean up timers
        timers.forEach(timer => clearTimeout(timer));
      };
    } else {
      // For non-embedded view, just do a single scroll
      scrollToBottom();
    }
  }, [chats.length, embedded]);
  
  // Use a more aggressive approach with the ResizeObserver and MutationObserver
  useEffect(() => {
    if (chatContainerRef.current && embedded) {
      // MutationObserver watches for DOM changes in the chat container
      const mutationObserver = new MutationObserver(() => {
        scrollToBottom();
      });
      
      // ResizeObserver watches for size changes in the chat container
      const resizeObserver = new ResizeObserver(() => {
        scrollToBottom();
      });
      
      // Observe the chat container for changes
      mutationObserver.observe(chatContainerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
      
      // Observe for size changes too
      resizeObserver.observe(chatContainerRef.current);
      
      // Clean up observers on unmount
      return () => {
        mutationObserver.disconnect();
        resizeObserver.disconnect();
      };
    }
  }, [embedded]);
  
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

  // Watch for changes in isProcessing state and update the typing indicator accordingly
  useEffect(() => {
    if (isProcessing) {
      console.log(`✅ [GPTChat:${cardId}] Processing started - showing typing indicator`);
      setForceShowTyping(true);
      
      // Add detailed logging for image generation
      // The backend sets the card's processing flag when generating images
      console.log(`🔍 [GPTChat:${cardId}] Card processing state is now TRUE - this could be for image generation`);
    } else {
      console.log(`❌ [GPTChat:${cardId}] Processing ended - hiding typing indicator`);
      setForceShowTyping(false);
      
      // Add detailed logging for image generation completion
      console.log(`🔍 [GPTChat:${cardId}] Card processing state is now FALSE - any image generation has completed`);
    }
  }, [isProcessing, cardId]);
  
  // Monitor changes to the chats array - this ensures the typing indicator disappears
  // immediately when a new message is received, even if the processing state is delayed
  const chatsLength = useRef(chats.length);
  useEffect(() => {
    // If the number of chats has increased (a new message arrived)
    if (chats.length > chatsLength.current) {
      console.log(`📨 [GPTChat:${cardId}] New message received - hiding typing indicator immediately`);
      setForceShowTyping(false);
    }
    // Update the reference to the current length
    chatsLength.current = chats.length;
  }, [chats, cardId]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    // Store a copy of the message text before clearing the input
    const sentMessage = message.trim();
    
    // Log user message content for debugging
    console.log(`📝 [GPTChat:${cardId}] User message: "${sentMessage}"`);
    
    // Check if this is an image request using the imported patterns
    const isImageRequest = imageRequestPatterns.some(pattern => pattern.test(sentMessage));
    
    // Log image request detection
    if (isImageRequest) {
      console.log(`🖼️ [GPTChat:${cardId}] Image request detected: "${sentMessage}"`);
    }
    
    // Turn on the typing indicator immediately when sending
    // This shows the indicator before the server starts processing
    console.log(`✅ [GPTChat:${cardId}] Setting force show typing to true on message send`);
    setForceShowTyping(true);
    
    setIsSending(true);
    // Reset user scroll state when sending a new message
    setUserHasScrolled(false);
    
    try {
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
      console.log(`🔄 [GPTChat:${cardId}] Sending message to backend...`);
      await apiRequest("POST", `/api/chats`, {
        cardId,
        role: "user",
        content: sentMessage
      });
      console.log(`✅ [GPTChat:${cardId}] Message sent to backend successfully`);
      
      // Start polling for processing status to get new messages
      queryClient.invalidateQueries({ queryKey: [`/api/cards/${cardId}/processing-status`] });
      // Also update the board data
      queryClient.invalidateQueries({ queryKey: [`/api/boards`] });
      
      // If it's an image request, we expect the processing to take longer
      // The backend will handle setting the card's processing flag
      if (isImageRequest) {
        console.log(`🖼️ [GPTChat:${cardId}] Image processing started, waiting for backend generation...`);
        // Keep the typing indicator visible until processing completes
        // isProcessing will be monitored via useCardProcessing hook
      }
      
      // Scroll to bottom after sending a message
      // Using smooth scroll for better user experience
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
        
        // Keep focus on the input field after sending the message
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
      
      // The typing indicator will be turned off automatically 
      // when the isProcessing state changes to false in the useEffect above
      
    } catch (error) {
      console.error(`❌ [GPTChat:${cardId}] Error sending message:`, error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
      // Turn off typing indicator on error
      setForceShowTyping(false);
    } finally {
      setIsSending(false);
    }
  };

  // Chat messages component - separated for cleaner structure
  const ChatMessages = () => {
    if (chats.length === 0 && !isProcessing) {
      // Determine the message based on whether this is a GPT column or not
      const message = gptName === "Comments" 
        ? "No comments yet. Leave a comment about this card." 
        : "No messages yet. Ask the AI a question to start the conversation.";
        
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-sm text-center text-muted-foreground p-4">
            {message}
          </div>
        </div>
      );
    }
    
    // Find the last assistant message index
    const lastAssistantIndex = chats
      .map((chat, index) => ({ chat, index }))
      .filter(item => item.chat.role === 'assistant')
      .pop()?.index;
    
    // Debug logging for processing state
    useEffect(() => {
      console.log(`🔍 [GPTChat:${cardId}] isProcessing changed to: ${isProcessing}`);
      console.log(`🔍 [GPTChat:${cardId}] finalOutput exists: ${!!finalOutput}`);
      console.log(`🔍 [GPTChat:${cardId}] embedded: ${!!embedded}`);
    }, [isProcessing, finalOutput, embedded, cardId]);
    
    // Determine if we should show processing indicator
    // Hide it if we already have a final output (could be stuck in processing state)
    // Also hide it when embedded in a card (per user requirement)
    
    // We use the forceShowTyping state from the parent component
    // This state is managed directly in the handleSendMessage function
    
    // Modified processing detection logic: 
    // Allow typing indicators to appear even in embedded mode
    const regularProcessingIndicator = isProcessing && !finalOutput;
    
    // Combine both signals - show if either is true
    const shouldShowProcessing = regularProcessingIndicator || forceShowTyping;
    
    // Log whether processing indicator should show
    useEffect(() => {
      console.log(`🔍 [GPTChat:${cardId}] shouldShowProcessing: ${shouldShowProcessing} (regular: ${regularProcessingIndicator}, forced: ${forceShowTyping})`);
    }, [shouldShowProcessing, regularProcessingIndicator, forceShowTyping, cardId]);
    
    // Direct processing indicator implementation - simpler and more reliable
    const getBgColor = () => {
      if (gptColor === 'Mint') return 'bg-[#DDFFE7]';
      if (gptColor === 'Sky') return 'bg-[#E1F2FE]';
      if (gptColor === 'Peach') return 'bg-[#FEE9D7]';
      if (gptColor === 'Lavender') return 'bg-[#F6E6FF]';
      return 'bg-[#E0F9FF]'; // Default Aqua
    };
    
    const getTextColor = () => {
      if (gptColor === 'Mint') return 'text-[#1A9E5E]';
      if (gptColor === 'Sky') return 'text-[#2E7EC9]';
      if (gptColor === 'Peach') return 'text-[#E25B3D]';
      if (gptColor === 'Lavender') return 'text-[#C235D1]';
      return 'text-[#3992B0]'; // Default Aqua
    };
    
    // Log when the indicator renders or doesn't render
    useEffect(() => {
      if (shouldShowProcessing) {
        console.log(`✅ [GPTChat:${cardId}] Processing indicator SHOULD be visible`);
      } else {
        console.log(`❌ [GPTChat:${cardId}] Processing indicator should NOT be visible`);
      }
    }, [shouldShowProcessing, cardId]);
    
    const processingIndicator = shouldShowProcessing && (
      <div className="flex items-start mb-3">
        <div className={`flex items-center gap-2 p-2.5 ${getBgColor()} rounded-lg max-w-[80%] animate-pulse-gentle transition-opacity`}>
          <div className="relative h-4 w-10">
            <span className={`absolute left-0 w-2 h-2 rounded-full bg-current ${getTextColor()} animate-typing1 opacity-70`}></span>
            <span className={`absolute left-3 w-2 h-2 rounded-full bg-current ${getTextColor()} animate-typing2 opacity-70`}></span>
            <span className={`absolute left-6 w-2 h-2 rounded-full bg-current ${getTextColor()} animate-typing3 opacity-70`}></span>
          </div>
          <span className={`text-sm font-medium ${getTextColor()}`}>
            {gptName} is thinking...
          </span>
        </div>
      </div>
    );
    
    // Function to render attachment images in messages
    const renderImageInMarkdown = (src: string, alt: string) => {
      console.log("[IMAGE-HANDLING] Image rendering requested but functionality is disabled for reimplementation");
      
      // Display a notice that image functionality is temporarily unavailable
      return (
        <div className="my-2 rounded-lg overflow-hidden border border-amber-200 bg-amber-50 p-4 text-amber-700">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5" />
            <span className="font-medium">Image Generation Temporarily Unavailable</span>
          </div>
          <p className="mt-2 text-sm">
            The image functionality is currently being reimplemented to provide enhanced capabilities. Regular chat functionality remains available.
          </p>
        </div>
      );
    };
    
    return (
      <div className="space-y-6 flex flex-col">
        {/* We don't show processing indicator here anymore - only at the bottom */}
        
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
                    ? `${getColorStyle(chat.gptColor || gptColor).bg} ${getColorStyle(chat.gptColor || gptColor).text} ${getColorStyle(chat.gptColor || gptColor).border}`
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}>
                  {chat.role === 'assistant' 
                    ? (isLastAIMessage 
                      ? (<span className="flex items-center">
                          <Sparkles className={`h-3 w-3 mr-1 ${getColorStyle(chat.gptColor || gptColor).text}`} /> 
                          {chat.gptName || gptName}
                        </span>)
                      : (<span>{chat.gptName || gptName}</span>)) 
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
                      ? `${getColorStyle(chat.gptColor || gptColor).bg} text-gray-800 rounded-lg rounded-tl-none border-2 ${getColorStyle(chat.gptColor || gptColor).border} py-2 px-3 shadow-sm` 
                      : 'text-gray-800 pl-0 pr-1'  // No bubble for non-latest GPT messages
                    : 'bg-blue-50 text-gray-800 rounded-lg rounded-tr-none border border-blue-100 py-2 px-3 shadow-sm' // User bubble stays the same
                }`}>

                  {isLastAIMessage && (finalOutput || (!isProcessing && chat.content)) && (
                    <div className="flex items-center mb-2 mt-1">
                      <span className="text-xs font-medium text-green-800">Latest Response</span>
                    </div>
                  )}
                  {chat.role === 'assistant' ? (
                    <>
                      {/* Debug elements removed to fix mobile rendering issues */}
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
                          img: (props: any) => renderImageInMarkdown(props.src, props.alt),
                        }}
                      >
                        {chat.content}
                      </ReactMarkdown>
                    </>
                  ) : (
                    <div>{chat.content}</div>
                  )}
                </div>
                
                {/* No user avatar, we're using pillbox names above instead */}
              </div>
            </div>
          );
        })}
        
        {/* Add typing indicator at the end of all messages */}
        {processingIndicator}
      </div>
    );
  };

  // Prepare the content based on whether it's embedded or not
  const chatContent = embedded ? (
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
        className="flex-1 px-4 py-3 flex flex-col scroll-smooth chat-message-container"
      >
        <ChatMessages />
      </div>
      
      {/* Chat Input - Always at the bottom */}
      <div className="border-t border-gray-100 p-3 flex items-center gap-2 bg-gray-50/60 sticky bottom-0 z-10 rounded-b-lg">
        <Input
          ref={inputRef}
          type="text"
          placeholder={gptName === "Comments" 
            ? "Add a comment..." 
            : `Ask ${gptName || 'AI'} a question or try "generate an image of..."`}
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
  ) : (
    <div className="flex flex-col">
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="text-sm font-medium text-gray-700">
          {gptName === "Comments" ? "Comments" : `Conversation with ${gptName || 'AI Assistant'}`}
        </div>
      </div>
      
      <div className="flex flex-col">
        <div 
          ref={chatContainerRef}
          className="flex-1 px-4 py-4 space-y-6 flex flex-col h-[300px] scroll-smooth chat-message-container"
        >
          <ChatMessages />
        </div>
        
        {/* Chat Input - Fixed at the bottom */}
        <div className="border-t border-gray-100 p-3 flex items-center gap-2 bg-gray-50/60">
          <Input
            ref={inputRef}
            type="text"
            placeholder={gptName === "Comments" 
              ? "Add a comment..." 
              : `Ask ${gptName || 'AI'} a question or try "generate an image of..."`}
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

  // Return a single component with only one instance of the ImageDialogModal
  return (
    <>
      {chatContent}
      {/* Only include the shared image dialog component once for both embedded and standard views */}
      <ImageDialogModal selectedImage={selectedImage} setSelectedImage={setSelectedImage} />
    </>
  );
}