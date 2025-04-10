import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

export function ImageGenerationTest() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [cardId, setCardId] = useState<number | null>(null);

  // Simple function to handle generating an image
  const handleGenerateImage = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setResult(null);
    
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
      const maxAttempts = 30; // 30 x 2 seconds = 60 seconds maximum wait
      
      const checkStatus = async () => {
        attempts++;
        if (attempts > maxAttempts) {
          setResult({
            success: false,
            message: "Timed out waiting for image generation to complete"
          });
          setIsGenerating(false);
          return;
        }
        
        const statusResponse = await apiRequest("GET", `/api/cards/${card.id}/processing-status`);
        const status = await statusResponse.json();
        
        if (status.processingError) {
          setResult({
            success: false,
            message: `Error: ${status.processingError}`
          });
          setIsGenerating(false);
          return;
        }
        
        if (!status.processing) {
          // Processing is done, check if we have an attachment
          const attachmentsResponse = await apiRequest("GET", `/api/cards/${card.id}`);
          const cardWithAttachments = await attachmentsResponse.json();
          
          if (cardWithAttachments.attachments?.length > 0) {
            const imageAttachments = cardWithAttachments.attachments.filter((a: any) => a.fileType.includes('image'));
            if (imageAttachments.length > 0) {
              setResult({
                success: true,
                message: `Successfully generated image! Attachment ID: ${imageAttachments[0].id}`
              });
              setIsGenerating(false);
              
              // Invalidate queries to ensure the UI updates
              queryClient.invalidateQueries({ queryKey: [`/api/cards/${card.id}`] });
              return;
            }
          }
          
          // No attachments found but processing is done
          setResult({
            success: false,
            message: "Processing completed but no image was generated"
          });
          setIsGenerating(false);
          return;
        }
        
        // Still processing, check again after a delay
        setTimeout(checkStatus, 2000);
      };
      
      // Start checking status
      checkStatus();
      
    } catch (error) {
      console.error("Error in image generation:", error);
      setResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      });
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-sm bg-white">
      <h3 className="text-lg font-semibold mb-4">Image Generation Test</h3>
      
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter an image prompt..."
            className="flex-1"
            disabled={isGenerating}
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
            Generating image, please wait...
          </div>
        )}
        
        {result && (
          <div className={`text-sm p-2 rounded ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {result.message}
          </div>
        )}
        
        {result?.success && cardId && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="text-sm font-medium mb-2">Generated Image:</h4>
            <div className="aspect-square max-w-xs mx-auto bg-white rounded-md overflow-hidden shadow-sm">
              <img 
                src={`/api/cards/${cardId}/attachment-preview`} 
                alt="Generated" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  // If loading the preview fails, try to get the actual attachment
                  const img = e.target as HTMLImageElement;
                  img.src = `/api/attachments/${result.message.match(/ID: (\d+)/)?.[1] || 0}`;
                }}
              />
            </div>
            <div className="mt-2 text-xs text-center text-gray-500">
              Card ID: {cardId} - You can view this image in the card details
            </div>
          </div>
        )}
      </div>
    </div>
  );
}