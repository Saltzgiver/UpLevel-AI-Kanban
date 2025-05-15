import { useState, useEffect, useRef } from "react";
import { Loader2, SendHorizontal, RefreshCw, Maximize2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import remarkGfm from "remark-gfm";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { AttachmentItem } from "./attachment-item";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import {
  Chat,
  Attachment,
} from "@shared/schema";

type ColorName = "Peach" | "Sky" | "Lavender" | "Mint" | "Aqua";

type ColorStyles = {
  bg: string;
  text: string;
  border: string;
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

const getColorStyle = (colorName: string | null | undefined, defaultColor: ColorName = "Peach"): ColorStyles => {
  const colors: Record<ColorName, ColorStyles> = {
    Peach: {
      bg: "bg-orange-50",
      text: "text-orange-900",
      border: "border-orange-100",
    },
    Sky: {
      bg: "bg-blue-50",
      text: "text-blue-900",
      border: "border-blue-100",
    },
    Lavender: {
      bg: "bg-purple-50",
      text: "text-purple-900",
      border: "border-purple-100",
    },
    Mint: {
      bg: "bg-green-50",
      text: "text-green-900",
      border: "border-green-100",
    },
    Aqua: {
      bg: "bg-cyan-50",
      text: "text-cyan-900",
      border: "border-cyan-100",
    },
  };

  // Check if colorName is a valid color name
  if (colorName && Object.keys(colors).includes(colorName as ColorName)) {
    return colors[colorName as ColorName];
  }

  // Default to Peach if no valid color is provided
  return colors[defaultColor];
};

function ImageDialogModal({ 
  isOpen, 
  onClose, 
  src, 
  alt 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  src: string; 
  alt: string;
}) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <div className="flex flex-col items-center justify-center">
          <p className="text-sm text-center mb-2">{alt}</p>
          <div className="max-h-[80vh] overflow-auto">
            <img 
              src={src} 
              alt={alt} 
              className="max-w-full object-contain"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function GPTChat({ 
  cardId, 
  chats, 
  gptName, 
  gptColor,
  embedded = false,
  finalOutput,
  isProcessing = false,
  attachments = []
}: GPTChatProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
  const [showFullOutput, setShowFullOutput] = useState<boolean>(false);
  const queryClient = useQueryClient();

  // Scroll to bottom when chats change
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chats]);

  const latestChat = chats && chats.length > 0 ? chats[chats.length - 1] : null;

  // Extract GPT color styles
  const colorStyle = getColorStyle(gptColor);

  const handleSendMessage = async () => {
    try {
      if (!message.trim()) return;
      
      setIsSending(true);
      
      const response = await fetch(`/api/cards/${cardId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardId,
          content: message,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      // Clear the message input
      setMessage("");
      
      // Invalidate the chats query to refresh the chat list
      queryClient.invalidateQueries({ queryKey: [`/api/cards/${cardId}/chats`] });
      queryClient.invalidateQueries({ queryKey: [`/api/cards/${cardId}/attachments`] });
    } catch (error) {
      console.error("Error sending message:", error);
      // Handle error case
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Render the final output card if provided
  const renderFinalOutput = () => {
    if (!finalOutput) return null;
    
    return (
      <Card className="bg-white shadow-sm mb-4">
        <CardContent className="p-4">
          <div className="flex flex-col space-y-2">
            <div className="flex items-start space-x-2">
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">Final Output</p>
                <div className="text-xs prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                  >
                    {finalOutput}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Function to render attachment images in messages
  const renderImageInMarkdown = (src: string, alt: string) => {
    // Log the image source for debugging
    console.log(`🖼️ [GPTChat:${cardId}] Rendering image in markdown: ${src}`, { alt });
    
    // Handle empty source with "Generated image" alt text - indicates an image reference
    // without a proper URL but we can try to find the matching attachment
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
      
      return (
        <div className="bg-gray-50 border border-gray-200 rounded p-2 text-xs text-gray-500 my-1 italic inline-block">
          {placeholderText}
        </div>
      );
    }
    
    // If it's a standard URL, render the image with error handling
    const attachmentId = src.match(/\/api\/attachments\/(\d+)/)?.[1];

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
            alt={alt || 'AI Generated Image'} 
            className="max-w-full object-cover max-h-64 hover:opacity-95 transition-opacity"
            onLoad={() => console.log(`🖼️ [GPTChat:${cardId}] Image loaded successfully: ${src}`)}
            onError={(e) => {
              console.error(`🖼️ [GPTChat:${cardId}] Error loading image: ${src}`, e);
              // Replace with error message on load failure
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'bg-red-50 border border-red-200 rounded-md p-2 text-red-500 text-xs';
                errorDiv.textContent = `Failed to load image (ID: ${attachmentId})`;
                parent.appendChild(errorDiv);
              }
            }}
            onClick={() => setSelectedImage({ src, alt: alt || 'AI Generated Image' })}
          />
        </div>
      </div>
    );
  };

  return (
    <div 
      className={`flex flex-col ${embedded ? '' : 'h-full'}`}
      style={{ minHeight: embedded ? 'auto' : '350px' }}
    >
      <ImageDialogModal 
        isOpen={!!selectedImage} 
        onClose={() => setSelectedImage(null)} 
        src={selectedImage?.src || ''} 
        alt={selectedImage?.alt || ''} 
      />
      
      <div className="flex-1 overflow-y-auto pb-2 space-y-4">
        {/* Final output display */}
        {renderFinalOutput()}
        
        {/* Chat history */}
        <div className="space-y-3">
          {chats.length === 0 ? (
            <div className="p-3 text-center text-sm text-gray-500">
              No messages yet. Start a conversation with the AI assistant.
            </div>
          ) : (
            chats.map((chat) => (
              <div key={chat.id} className="flex flex-col space-y-1">
                <div className="flex items-start space-x-2">
                  {chat.role === "user" ? (
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-gray-100">U</AvatarFallback>
                    </Avatar>
                  ) : (
                    <Avatar className={`h-6 w-6 ${colorStyle.bg}`}>
                      <AvatarFallback className={`text-[10px] ${colorStyle.text}`}>
                        {gptName.substring(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div className="flex-1 space-y-1">
                    <p className="text-[10px] font-medium">
                      {chat.role === "user" ? "You" : gptName}
                    </p>
                    
                    {chat.role === "user" ? (
                      <p className="text-xs">{chat.content}</p>
                    ) : (
                      (() => {
                        // Process content for special patterns 
                        // Check if it's a file pattern that needs to be converted to markdown image format
                        const standardPattern = /!\[Generated image\]\(\/api\/attachments\/(\d+)\)/;
                        const anglePattern = /!\[Generated image\]\(<[^>]+>\)/;
                        const filePattern = /file:([^,]+),([^,]+),(.*)/;
                        
                        const stdMatch = chat.content.match(standardPattern);
                        const angleMatch = chat.content.match(anglePattern);
                        const fileMatch = chat.content.match(filePattern);
                        
                        let processedContent = chat.content;
                        
                        // Standard markdown image with attachment ID - already in correct format
                        if (stdMatch && stdMatch[1]) {
                          const attachmentId = stdMatch[1];
                          console.log(`🔍 [GPTChat:${cardId}] Found standard image pattern with attachment ID: ${attachmentId}`);
                          // This is already in the correct format for markdown processing
                        }
                        // Angle bracket format - will be handled by renderImageInMarkdown
                        else if (angleMatch) {
                          console.log(`🔍 [GPTChat:${cardId}] Detected angle bracket placeholder in image markdown`);
                          // No replacement needed - will be handled by renderImageInMarkdown
                        }
                        // File pattern format - convert to proper markdown
                        else if (fileMatch) {
                          const [, filename, mimetype, content] = fileMatch;
                          console.log(`🔍 [GPTChat:${cardId}] Converting file pattern to markdown image: ${filename}`);
                          
                          if (mimetype.includes('image')) {
                            console.log(`🔍 [GPTChat:${cardId}] Processing image file pattern: ${filename}, mime: ${mimetype}`);
                                
                            // For images, try to find the attachment first
                            const matchingAttachment = attachments?.find(a => a.filename === filename);
                            
                            if (matchingAttachment) {
                              console.log(`Found matching attachment with ID: ${matchingAttachment.id}`);
                              processedContent = `![Generated image](/api/attachments/${matchingAttachment.id})`;
                            } else {
                              // If we don't have the attachment in our list, we need to fetch all possible attachments for this card
                              console.log(`No matching attachment found for ${filename}, fetching all card attachments`);
                              
                              // Force a refresh of card attachments
                              if (cardId && typeof cardId === "number") {
                                console.log(`Forcing refresh of attachments for card ${cardId}`);
                                queryClient.invalidateQueries({ queryKey: [`/api/cards/${cardId}/attachments`] });
                                queryClient.invalidateQueries({ queryKey: [`/api/cards/${cardId}`] });
                              }
                              
                              // Since we can't find an attachment with this filename, we need to create a better fallback
                              // Try to extract attachment ID from the content if it's a URL
                              if (chat.content && chat.content.includes('/api/attachments/')) {
                                const attachmentMatches = chat.content.match(/\/api\/attachments\/([0-9]+)/);
                                if (attachmentMatches && attachmentMatches[1]) {
                                  const attachmentId = parseInt(attachmentMatches[1]);
                                  console.log(`Found attachment ID in content: ${attachmentId}`);
                                  processedContent = `![Generated image](/api/attachments/${attachmentId})`;
                                }
                              }
                              
                              // Return a direct markdown image string (this is a fallback)
                              processedContent = `![Generated image](${content && content.length < 100 ? content : `/api/attachments/image/${filename}`})`;
                            }
                          }
                        }  // Close the else pattern checks

                        // If content was modified, render with the processed content
                        if (processedContent !== chat.content) {
                          return (
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
                              {processedContent}
                            </ReactMarkdown>
                          );
                        }
                        
                        // Return the default rendering for unchanged content
                        return (
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
                        );
                      })()
                    )}
                    
                    {/* Display attachments at the bottom of chat messages */}
                    {!chat.isUser && attachments && attachments.length > 0 && chat === latestChat && (
                      <div className="mt-2 space-y-1">
                        {attachments.map((attachment) => (
                          <AttachmentItem 
                            key={attachment.id}
                            attachment={attachment}
                            onView={(attachment) => {
                              if (attachment.fileType?.includes('image')) {
                                setSelectedImage({ 
                                  src: `/api/attachments/${attachment.id}`, 
                                  alt: attachment.filename
                                });
                              }
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex items-center justify-center p-2 text-sm text-gray-500">
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
          Processing...
        </div>
      )}

      {/* Message input */}
      <div className="flex items-end space-x-2 pt-2">
        <div className="flex-1">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="resize-none min-h-[60px] max-h-[120px] text-sm"
            disabled={isSending || isProcessing}
          />
        </div>
        <Button
          onClick={handleSendMessage}
          disabled={!message.trim() || isSending || isProcessing}
          size="icon"
          variant="secondary"
          className={`${colorStyle.bg} ${colorStyle.border}`}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
        </Button>
        <Button
          onClick={() => queryClient.invalidateQueries({ queryKey: [`/api/cards/${cardId}/chats`] })}
          size="icon"
          variant="outline"
          className="h-10 w-10"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}