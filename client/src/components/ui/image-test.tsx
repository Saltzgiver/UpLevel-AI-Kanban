import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Loader2, RefreshCw, ExternalLink } from "lucide-react";

export function ImageGenerationTest() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [cardId, setCardId] = useState<number | null>(null);
  const [attachmentId, setAttachmentId] = useState<number | null>(null);
  const [attachmentURL, setAttachmentURL] = useState<string | null>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [isDirectMode, setIsDirectMode] = useState(false);

  // Direct image generation with OpenAI - more reliable but doesn't use the card system
  const generateImageDirectly = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setResult(null);
    setAttachmentId(null);
    setChats([]);
    
    try {
      // Create a direct API request to a new endpoint we'll create
      const response = await apiRequest("POST", "/api/generate-image", {
        prompt: prompt
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to generate image");
      }
      
      const data = await response.json();
      
      if (data.attachmentId) {
        setAttachmentId(data.attachmentId);
        setAttachmentURL(`/api/attachments/${data.attachmentId}`);
        setResult({
          success: true,
          message: `Successfully generated image! Attachment ID: ${data.attachmentId}`
        });
      } else {
        setResult({
          success: false,
          message: data.error || "No attachment was generated"
        });
      }
    } catch (error) {
      console.error("Error in direct image generation:", error);
      setResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Card-based image generation through the existing system
  const generateImageViaCard = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setResult(null);
    setChats([]);
    
    try {
      // First create a card in the imager column (column 9)
      const response = await apiRequest("POST", "/api/cards", {
        title: `Image: ${prompt.slice(0, 30)}${prompt.length > 30 ? '...' : ''}`,
        description: prompt,
        columnId: 9, // Assumes column 9 is set up for image generation
        order: 0
      });
      
      const card = await response.json();
      setCardId(card.id);
      
      // Add a chat message that should trigger image generation
      await apiRequest("POST", "/api/chats", {
        cardId: card.id,
        role: "user",
        content: `Generate an image of ${prompt}`
      });
      
      // Now we need to wait for processing to complete
      let attempts = 0;
      const maxAttempts = 20; // 20 x 3 seconds = 60 seconds maximum wait
      
      const checkStatus = async () => {
        attempts++;
        if (attempts > maxAttempts) {
          // Get the chats to see if there were any errors
          const chatsResponse = await apiRequest("GET", `/api/cards/${card.id}/chats`);
          const chatsData = await chatsResponse.json();
          setChats(chatsData);
          
          setResult({
            success: false,
            message: "Timed out waiting for image generation to complete"
          });
          setIsGenerating(false);
          return;
        }
        
        try {
          // Get the card to check if processing is done and if there are any attachments
          const cardResponse = await apiRequest("GET", `/api/cards/${card.id}`);
          
          if (!cardResponse.ok) {
            throw new Error(`Failed to fetch card: ${cardResponse.status}`);
          }
          
          const cardData = await cardResponse.json();
          
          // Get chats to check for error messages and display them
          const chatsResponse = await apiRequest("GET", `/api/cards/${card.id}/chats`);
          const chatsData = await chatsResponse.json();
          setChats(chatsData);
          
          // Check for error messages in the chats
          const errorMessage = chatsData
            .filter((chat: any) => chat.role === "assistant" && chat.content.includes("Error"))
            .map((chat: any) => chat.content)
            .join(" ");
          
          if (errorMessage) {
            setResult({
              success: false,
              message: errorMessage
            });
            setIsGenerating(false);
            return;
          }
          
          if (!cardData.processing) {
            // Processing is done, check if we have an attachment
            if (cardData.attachments?.length > 0) {
              const imageAttachments = cardData.attachments.filter((a: any) => a.fileType.includes('image'));
              if (imageAttachments.length > 0) {
                const attachId = imageAttachments[0].id;
                setAttachmentId(attachId);
                setAttachmentURL(`/api/attachments/${attachId}`);
                
                setResult({
                  success: true,
                  message: `Successfully generated image! Attachment ID: ${attachId}`
                });
                setIsGenerating(false);
                return;
              }
            }
            
            // No attachments found but processing is done
            // This might mean there was an error during processing that wasn't caught
            setResult({
              success: false,
              message: "Processing completed but no image was generated. Check the logs for errors."
            });
            setIsGenerating(false);
            return;
          }
          
          // Still processing, check again after a delay
          setTimeout(checkStatus, 3000);
        } catch (checkError) {
          console.error("Error checking card status:", checkError);
          setResult({
            success: false, 
            message: `Error checking status: ${checkError instanceof Error ? checkError.message : "Unknown error"}`
          });
          setIsGenerating(false);
        }
      };
      
      // Start checking status
      setTimeout(checkStatus, 3000);
      
    } catch (error) {
      console.error("Error in image generation:", error);
      setResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      });
      setIsGenerating(false);
    }
  };
  
  // Choose the right generation method based on mode
  const handleGenerateImage = () => {
    if (isDirectMode) {
      generateImageDirectly();
    } else {
      generateImageViaCard();
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-sm bg-white">
      <h3 className="text-lg font-semibold mb-4">Image Generation Test</h3>
      
      <div className="space-y-4">
        <div className="flex gap-2 items-center mb-2">
          <div className="text-xs text-gray-500">Mode:</div>
          <Button 
            variant={isDirectMode ? "outline" : "default"} 
            size="sm"
            onClick={() => setIsDirectMode(false)}
            disabled={isGenerating}
          >
            Card Generation
          </Button>
          <Button 
            variant={isDirectMode ? "default" : "outline"} 
            size="sm"
            onClick={() => setIsDirectMode(true)}
            disabled={isGenerating}
          >
            Direct Generation
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter an image prompt..."
            className="flex-1"
            disabled={isGenerating}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && prompt.trim()) {
                handleGenerateImage();
              }
            }}
          />
          <Button 
            onClick={handleGenerateImage} 
            disabled={isGenerating || !prompt.trim()}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating
              </>
            ) : (
              "Generate Image"
            )}
          </Button>
        </div>
        
        {isGenerating && (
          <div className="text-sm text-amber-600 flex items-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-amber-600" />
            Generating image, please wait... ({isDirectMode ? 'Direct mode' : 'Card mode'})
          </div>
        )}
        
        {result && (
          <div className={`text-sm p-2 rounded ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {result.message}
          </div>
        )}
        
        {attachmentId && attachmentURL && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="text-sm font-medium mb-2 flex justify-between">
              <span>Generated Image:</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const img = document.getElementById('generated-img') as HTMLImageElement;
                    if (img) {
                      img.src = `${attachmentURL}?reload=${Date.now()}`;
                    }
                  }}
                  className="text-xs text-blue-600 flex items-center"
                >
                  <RefreshCw className="h-3 w-3 mr-1" /> Reload
                </button>
                <a 
                  href={attachmentURL} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 flex items-center"
                >
                  <ExternalLink className="h-3 w-3 mr-1" /> Open
                </a>
              </div>
            </h4>
            <div className="aspect-square max-w-xs mx-auto bg-white rounded-md overflow-hidden shadow-sm">
              <img 
                id="generated-img"
                src={attachmentURL} 
                alt="Generated" 
                className="w-full h-full object-contain"
                onLoad={() => console.log("Image loaded successfully")}
                onError={(e) => {
                  console.error("Error loading image:", e);
                  const img = e.target as HTMLImageElement;
                  img.src = `${attachmentURL}?reload=${Date.now()}`;
                }}
              />
            </div>
            <div className="mt-2 text-xs text-center text-gray-500">
              {cardId ? `Card ID: ${cardId} - Attachment ID: ${attachmentId}` : `Attachment ID: ${attachmentId}`}
            </div>
          </div>
        )}
        
        {chats.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Chat Messages:</h4>
            <div className="text-xs space-y-2 max-h-40 overflow-y-auto">
              {chats.map((chat, index) => (
                <div 
                  key={index} 
                  className={`p-2 rounded ${
                    chat.role === 'assistant' 
                      ? chat.content.includes('Error') 
                        ? 'bg-red-50 text-red-800' 
                        : 'bg-blue-50 text-blue-800'
                      : 'bg-gray-50 text-gray-800'
                  }`}
                >
                  <div className="font-medium">{chat.role === 'assistant' ? 'AI' : 'User'}:</div>
                  <div>{chat.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}