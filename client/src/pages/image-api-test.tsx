import React, { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

export default function ImageApiTest() {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState("1024x1024");
  const [resultType, setResultType] = useState<"success" | "error" | null>(null);
  const { toast } = useToast();

  const handleImageGeneration = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a prompt for the image generation",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setImageUrl(null);
      setResponseTime(null);
      setResultType(null);

      // Record start time for timing
      const startTime = Date.now();

      // Call image generation endpoint
      const response = await fetch("/api/image-generation/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt, size: imageSize }),
      });

      // Calculate response time
      const endTime = Date.now();
      const timeElapsed = (endTime - startTime) / 1000; // in seconds
      setResponseTime(timeElapsed);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate image");
      }

      const data = await response.json();
      
      // Set result data
      setImageUrl(data.url || data.base64);
      setResultType("success");
      
      toast({
        title: "Success",
        description: `Image generated in ${timeElapsed.toFixed(1)} seconds`,
      });
    } catch (err) {
      console.error("Image generation error:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setResultType("error");
      
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to generate image",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">OpenAI Image Generation Test</h1>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Test Image Generation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Image Size</label>
                <div className="flex space-x-2">
                  {["1024x1024", "1024x1792", "1792x1024"].map((size) => (
                    <Button
                      key={size}
                      variant={imageSize === size ? "default" : "outline"}
                      onClick={() => setImageSize(size)}
                      className="text-xs"
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Image Prompt</label>
                <Textarea
                  placeholder="Enter a detailed description of the image you want to generate..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Be specific and descriptive for best results.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <div className="text-sm text-muted-foreground">
              {responseTime !== null && (
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  <span>Response time: {responseTime.toFixed(2)}s</span>
                </div>
              )}
            </div>
            <Button onClick={handleImageGeneration} disabled={isLoading || !prompt.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Image"
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Results Card */}
        {(imageUrl || error) && (
          <Card className={resultType === "error" ? "border-destructive" : "border-green-500"}>
            <CardHeader>
              <CardTitle className="flex items-center">
                {resultType === "error" ? (
                  <>
                    <AlertCircle className="w-5 h-5 mr-2 text-destructive" />
                    Error
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 mr-2 text-green-500" />
                    Generated Image
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="p-4 rounded bg-destructive/10 text-destructive">
                  <pre className="whitespace-pre-wrap text-sm font-mono">{error}</pre>
                </div>
              )}
              
              {imageUrl && (
                <div className="space-y-4">
                  <Dialog>
                    <DialogTrigger asChild>
                      <div className="relative cursor-pointer group overflow-hidden border rounded-md">
                        <img 
                          src={imageUrl.startsWith('data:') ? imageUrl : imageUrl} 
                          alt="Generated" 
                          className="w-full object-contain transition-transform group-hover:scale-105" 
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white font-medium">Click to enlarge</span>
                        </div>
                      </div>
                    </DialogTrigger>
                    <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-auto">
                      <img 
                        src={imageUrl.startsWith('data:') ? imageUrl : imageUrl} 
                        alt="Generated (full size)" 
                        className="w-full h-full object-contain" 
                      />
                    </DialogContent>
                  </Dialog>
                  
                  <div className="bg-muted p-3 rounded-md">
                    <h3 className="text-sm font-medium mb-1">Debug Information</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="font-medium">Response Time:</span> {responseTime?.toFixed(2)}s
                      </div>
                      <div>
                        <span className="font-medium">Image Size:</span> {imageSize}
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium">URL Type:</span> {imageUrl.startsWith('data:') ? 'Base64 Data URL' : 'HTTP URL'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Diagnostic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Diagnostic Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-2">
              <p>
                <span className="font-medium">About this test tool:</span> This page allows you to directly test the OpenAI image generation API to verify it's working properly.
              </p>
              <p>
                <span className="font-medium">Expected behavior:</span> Authentic image generation from OpenAI should take several seconds to complete (typically 5-15 seconds). 
                If images are generated instantly (under 1 second), it likely indicates a mock/intercepted response.
              </p>
              <p>
                <span className="font-medium">Resolution steps:</span> If you're seeing instantaneous responses, check for fetch interceptors, mock implementations, or test configurations that might be replacing the actual API calls.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}