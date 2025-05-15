import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, Send, Loader2, Sparkles, X, Maximize2, ExternalLink, Paperclip, RefreshCcw } from "lucide-react";
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
import { AttachmentItem } from "./attachment-item";
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
  // Add more patterns to match the server
  /new image/i,
];

function ImageDialogModal({ 
  isOpen,
  onClose,
  imageSrc,
  imageAlt
}: { 
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  imageAlt: string;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{imageAlt || "Image Preview"}</DialogTitle>
          <DialogClose onClick={onClose} />
        </DialogHeader>
        <div className="flex items-center justify-center p-2">
          <img 
            src={imageSrc} 
            alt={imageAlt || "Image Preview"} 
            className="max-w-full max-h-[70vh] object-contain" 
          />
        </div>
        <div className="flex justify-end p-2">
          <a 
            href={imageSrc} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center text-sm text-blue-500 hover:underline"
          >
            Open in New Tab <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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

/**
 * Enhanced GPT Chat component with improved image rendering
 * for both empty sources and angle bracket placeholders
 */
export function GPTChat({ 
  cardId,
  chats,
  gptName,
  gptColor = "Peach",
  embedded = false,
  finalOutput = null,
  isProcessing = false,
  attachments = []
}: GPTChatProps) {
  const [expanded, setExpanded] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Function to detect if a message is an image generation request
  const isImageGenerationRequest = (message: string) => {
    return imageRequestPatterns.some(pattern => pattern.test(message.toLowerCase()));
  };

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chats, isProcessing]);

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    setIsSending(true);
    
    try {
      const isImageRequest = isImageGenerationRequest(inputValue);
      
      if (isImageRequest) {
        console.log(`Detected image generation request: "${inputValue}"`);
        toast({
          title: "Image Generation Detected",
          description: "Generating image, please wait...",
          duration: 3000,
        });
      }
      
      await apiRequest(`/api/cards/${cardId}/chat`, {
        method: "POST",
        body: {
          content: inputValue,
        },
      });
      
      setInputValue("");
      
      // Refresh the card's data after sending a message
      await queryClient.invalidateQueries({ queryKey: [`/api/cards/${cardId}/chats`] });
      await queryClient.invalidateQueries({ queryKey: [`/api/cards/${cardId}`] });
      
      // Also refresh attachments in case new ones were created
      await queryClient.invalidateQueries({ queryKey: [`/api/cards/${cardId}/attachments`] });
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Function to render attachment images in messages with enhanced handling
  const renderImageInMarkdown = (src: string, alt: string) => {
    // Log the image source for debugging
    console.log(`🖼️ [GPTChat:${cardId}] Rendering image in markdown: ${src}`, { alt });
    
    // Handle empty source with "Generated image" alt text
    if ((!src || src === '') && alt === 'Generated image') {
      console.log(`🖼️ [GPTChat:${cardId}] Empty source with 'Generated image' alt text - looking for attachment`);
      
      // Find any image attachments sorted by most recent first
      if (attachments && attachments.length > 0) {
        const imageAttachments = attachments.filter(a => a.fileType?.includes('image'));
        
        if (imageAttachments.length > 0) {
          const sortedAttachments = [...imageAttachments].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          
          const mostRecentAttachment = sortedAttachments[0];
          console.log(`🖼️ [GPTChat:${cardId}] Found recent image attachment: ${mostRecentAttachment.id}`);
          
          const imageSrc = `/api/attachments/${mostRecentAttachment.id}`;
          
          return (
            <div className="my-2 inline-block">
              <div className="relative cursor-pointer group overflow-hidden rounded-md border border-gray-200">
                <div className="absolute top-1 right-1 z-10 bg-black/60 text-white px-1 py-0.5 text-[8px] rounded-sm">
                  AI Generated
                </div>
                <div className="absolute top-1 left-1 z-10 bg-black/60 text-white px-1 py-0.5 text-[8px] rounded-sm flex items-center opacity-70 group-hover:opacity-100">
                  <Maximize2 className="h-2.5 w-2.5 mr-0.5" />
                  <span>View full size</span>
                </div>
                <img 
                  src={imageSrc} 
                  alt="AI Generated Image" 
                  className="max-w-full max-h-64 object-cover" 
                  onClick={() => setSelectedImage({ src: imageSrc, alt: 'AI Generated Image' })}
                  onLoad={() => console.log(`🖼️ [GPTChat:${cardId}] Image loaded successfully: ${mostRecentAttachment.id}`)}
                  onError={(e) => console.error(`🖼️ [GPTChat:${cardId}] Error loading image: ${mostRecentAttachment.id}`, e)}
                />
              </div>
            </div>
          );
        }
      }
    }
    
    // Check for special cases - angle brackets indicate placeholder text, not a real URL
    if (src.startsWith('<') && src.endsWith('>')) {
      // Extract the text content from the brackets and create a meaningful fallback
      const placeholderText = src.substring(1, src.length - 1);
      console.log(`🖼️ [GPTChat:${cardId}] Found placeholder text instead of image URL: ${placeholderText}`);
      
      // Try to locate an attachment based on the description 
      const matchingAttachment = attachments?.find(a => {
        // Look for attachments with content type image and created recently
        const isImage = a.fileType?.startsWith('image/');
        // Check if the filename might match the description
        const isRelevant = a.filename?.toLowerCase().includes('card') ||
                          a.filename?.toLowerCase().includes(placeholderText.toLowerCase().substring(0, 5));
        return isImage && isRelevant;
      });
      
      if (matchingAttachment) {
        console.log(`🖼️ [GPTChat:${cardId}] Found matching attachment for description:`, matchingAttachment);
        // Use the attachment we found
        return (
          <div className="my-2 inline-block">
            <div className="relative cursor-pointer group overflow-hidden rounded-md border border-gray-200">
              <div className="absolute top-1 right-1 z-10 bg-black/60 text-white px-1 py-0.5 text-[8px] rounded-sm">
                AI Generated
              </div>
              <div className="absolute top-1 left-1 z-10 bg-black/60 text-white px-1 py-0.5 text-[8px] rounded-sm flex items-center opacity-70 group-hover:opacity-100">
                <Maximize2 className="h-2.5 w-2.5 mr-0.5" />
                <span>View full size</span>
              </div>
              <img 
                src={`/api/attachments/${matchingAttachment.id}`} 
                alt="AI Generated Image" 
                className="max-w-full max-h-64 object-cover"
                onClick={() => setSelectedImage({ src: `/api/attachments/${matchingAttachment.id}`, alt: 'AI Generated Image' })}
                onLoad={() => console.log(`🖼️ [GPTChat:${cardId}] Image loaded successfully: ${matchingAttachment.id}`)}
                onError={(e) => console.error(`🖼️ [GPTChat:${cardId}] Error loading image: ${matchingAttachment.id}`, e)}
              />
            </div>
          </div>
        );
      }
      
      // Fallback for when we can't find a matching attachment
      return (
        <div className="bg-gray-100 p-2 rounded my-1 text-xs italic">
          [Image: {placeholderText}]
          <div className="text-[10px] mt-1 text-gray-500">
            <RefreshCcw className="inline-block h-3 w-3 mr-1" />
            <span>Image generation in progress or unavailable</span>
          </div>
        </div>
      );
    }
    
    // Regular image URL - could be an attachment or external URL
    if (src && src.startsWith('/api/attachments/')) {
      console.log(`🖼️ [GPTChat:${cardId}] Rendering attachment image: ${src}`);
      return (
        <div className="my-2 inline-block">
          <div className="relative cursor-pointer group overflow-hidden rounded-md border border-gray-200">
            <div className="absolute top-1 right-1 z-10 bg-black/60 text-white px-1 py-0.5 text-[8px] rounded-sm">
              AI Generated
            </div>
            <div className="absolute top-1 left-1 z-10 bg-black/60 text-white px-1 py-0.5 text-[8px] rounded-sm flex items-center opacity-70 group-hover:opacity-100">
              <Maximize2 className="h-2.5 w-2.5 mr-0.5" />
              <span>View full size</span>
            </div>
            <img 
              src={src} 
              alt={alt || "AI Generated Image"} 
              className="max-w-full max-h-64 object-cover"
              onClick={() => setSelectedImage({ src, alt: alt || 'AI Generated Image' })}
              onLoad={() => console.log(`🖼️ [GPTChat:${cardId}] Image loaded successfully: ${src}`)}
              onError={(e) => console.error(`🖼️ [GPTChat:${cardId}] Error loading image: ${src}`, e)}
            />
          </div>
        </div>
      );
    }
    
    // Default case - just render as a regular image
    return (
      <div className="my-2 inline-block">
        <img 
          src={src} 
          alt={alt} 
          className="max-w-full max-h-64 rounded-md"
          onClick={() => setSelectedImage({ src, alt })}
        />
      </div>
    );
  };

  // Render the chat content
  return (
    <div 
      ref={containerRef}
      className={`bg-white rounded-lg shadow-sm border border-slate-200 ${embedded ? 'max-h-96' : ''}`}
    >
      <div className="p-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-xs text-slate-900">{gptName || "AI Assistant"}</span>
          <Badge variant="outline" className="text-[9px] py-0 h-4">GPT</Badge>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="h-5 w-5 rounded hover:bg-slate-200 flex items-center justify-center"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>
      
      {expanded && (
        <>
          <div className={`p-2 overflow-y-auto ${embedded ? 'max-h-64' : 'max-h-[50vh]'}`}>
            {chats.length === 0 ? (
              <div className="text-center py-4 text-slate-400 text-xs">
                No messages yet. Start a conversation!
              </div>
            ) : (
              <div className="space-y-2">
                {chats.map((chat) => (
                  <div key={chat.id} className={`rounded-lg p-2 ${
                    chat.isUser ? 'bg-blue-50 text-blue-900 ml-6' : 'bg-slate-50 text-slate-900 mr-6'
                  }`}>
                    <div className="text-[9px] font-medium mb-1">
                      {chat.isUser ? 'You' : gptName}
                    </div>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: (props) => <p className="my-0.5 text-xs" {...props} />,
                        ul: (props) => <ul className="list-disc pl-3 my-0.5 text-xs" {...props} />,
                        ol: (props) => <ol className="list-decimal pl-3 my-0.5 text-xs" {...props} />,
                        li: (props) => <li className="my-0 text-xs" {...props} />,
                        a: (props) => <a className="text-blue-600 hover:underline text-xs" {...props} />,
                        blockquote: (props) => <blockquote className="border-l-2 border-gray-300 pl-2 my-0.5 text-xs" {...props} />,
                        code: (props) => 
                          props.inline 
                            ? <code className="bg-gray-100 px-0.5 rounded text-[10px] font-mono" {...props} />
                            : <code className="block bg-gray-100 p-1 rounded text-[10px] font-mono my-0.5 overflow-x-auto" {...props} />,
                        pre: (props) => <pre className="bg-gray-100 p-1 rounded text-[10px] font-mono my-0.5 overflow-x-auto" {...props} />,
                        strong: (props) => <strong className="font-bold text-xs" {...props} />,
                        em: (props) => <em className="italic text-xs" {...props} />,
                        img: (props) => renderImageInMarkdown(props.src || "", props.alt || ""),
                      }}
                    >
                      {chat.content}
                    </ReactMarkdown>
                  </div>
                ))}
                {isProcessing && (
                  <div className="bg-slate-50 text-slate-900 rounded-lg p-2 mr-6">
                    <div className="text-[9px] font-medium mb-1">{gptName}</div>
                    <TypingIndicator />
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>
          
          <div className="p-2 border-t border-slate-200">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex space-x-2"
            >
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type a message..."
                className="text-xs h-8"
                disabled={isSending || isProcessing}
              />
              <Button 
                type="submit" 
                size="sm" 
                className="h-8 px-2" 
                disabled={isSending || isProcessing || !inputValue.trim()}
              >
                {isSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              </Button>
            </form>
          </div>
        </>
      )}
      
      {selectedImage && (
        <ImageDialogModal
          isOpen={!!selectedImage}
          onClose={() => setSelectedImage(null)}
          imageSrc={selectedImage.src}
          imageAlt={selectedImage.alt}
        />
      )}
    </div>
  );
}