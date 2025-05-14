import React, { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Clock, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function ImageApiTest() {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState("1024x1024");
  const [modelInfo, setModelInfo] = useState<string | null>(null);
  const [resultType, setResultType] = useState<"success" | "error" | null>(null);
  const [selectedModel, setSelectedModel] = useState<"gpt-image-1" | "dall-e-3" | "auto">("auto");
  const [imageQuality, setImageQuality] = useState<"low" | "medium" | "high" | "auto">("auto");
  const [apiDebugInfo, setApiDebugInfo] = useState<any>(null);
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
      setModelInfo(null);
      setResultType(null);
      setApiDebugInfo(null);

      // Record start time for timing
      const startTime = Date.now();

      // Call image generation endpoint
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          size: imageSize,
          model: selectedModel,
          quality: imageQuality,
        }),
      });

      const data = await response.json();
      
      // Calculate response time in seconds
      const endTime = Date.now();
      setResponseTime((endTime - startTime) / 1000);

      // Handle the response data
      if (response.ok) {
        if (data.error) {
          setError(data.error);
          setResultType("error");
          toast({
            title: "Error",
            description: "Failed to generate image",
            variant: "destructive",
          });
        } else {
          // Set URL for display
          setImageUrl(data.imageUrl); 
          
          // Set model info and result type for success state
          setModelInfo(data.model);
          setResultType("success");
          
          // Store debug info for the debug panel (if returned)
          if (data.debug) {
            setApiDebugInfo(data.debug);
          }
          
          toast({
            title: "Success",
            description: "Image generated successfully",
            variant: "default",
          });
        }
      } else {
        // Handle API errors
        setError(data.error || "Failed to generate image");
        setResultType("error");
        toast({
          title: "Error",
          description: "API request failed",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error generating image:", err);
      setError("An unexpected error occurred");
      setResultType("error");
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="px-6">
      <div className="container py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">OpenAI Image Generation Test</h1>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Generate Image</CardTitle>
              <CardDescription>
                Test the OpenAI image generation API with different models and settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="prompt">Image Prompt</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Describe the image you want to generate..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="model-select">Model</Label>
                    <Select 
                      value={selectedModel} 
                      onValueChange={(value) => setSelectedModel(value as any)}
                    >
                      <SelectTrigger id="model-select">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (Recommended)</SelectItem>
                        <SelectItem value="gpt-image-1">GPT-Image-1</SelectItem>
                        <SelectItem value="dall-e-3">DALL-E 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="size-select">Image Size</Label>
                    <Select 
                      value={imageSize} 
                      onValueChange={setImageSize}
                    >
                      <SelectTrigger id="size-select">
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1024x1024">1024×1024</SelectItem>
                        <SelectItem value="1024x1792">1024×1792</SelectItem>
                        <SelectItem value="1792x1024">1792×1024</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="quality-select">Quality</Label>
                    <Select 
                      value={imageQuality} 
                      onValueChange={(value) => setImageQuality(value as any)}
                    >
                      <SelectTrigger id="quality-select">
                        <SelectValue placeholder="Select quality" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t px-6 py-4">
              <div className="text-sm text-muted-foreground">
                {responseTime !== null && (
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>Response time: {responseTime.toFixed(2)}s</span>
                  </div>
                )}
              </div>
              <Button 
                onClick={handleImageGeneration} 
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Image
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
                
                {/* API Debug Information Section */}
                <div className="mt-4 border border-gray-200 dark:border-gray-800 rounded-md p-3">
                  <h3 className="text-sm font-medium mb-2 flex items-center">
                    <Info className="w-4 h-4 mr-1" />
                    API Request Details
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="col-span-2 mb-2">
                      <div className="font-semibold">Request Parameters:</div>
                      <div className="mt-1 font-mono bg-muted p-2 rounded">
                        <div>prompt: "{prompt.substring(0, 50)}..."</div>
                        <div>model: {selectedModel}</div>
                        <div>size: {imageSize}</div>
                        <div>quality: {imageQuality}</div>
                      </div>
                    </div>
                    
                    <div>
                      <span className="font-semibold">Response Time:</span> {responseTime?.toFixed(2)}s
                    </div>
                    <div>
                      <span className="font-semibold">Model Used:</span> {modelInfo || "Unknown"}
                    </div>
                    
                    {apiDebugInfo && (
                      <div className="col-span-2 mt-2">
                        <div className="font-semibold mb-1">Response Details:</div>
                        <pre className="text-xs font-mono bg-muted p-2 rounded max-h-32 overflow-auto">
                          {JSON.stringify(apiDebugInfo, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Image Display */}
                {imageUrl && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium mb-2">Generated Image:</h3>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <div className="cursor-pointer border rounded-md overflow-hidden hover:opacity-90 transition-opacity">
                          <img 
                            src={imageUrl} 
                            alt="Generated from prompt" 
                            className="w-full h-auto object-contain"
                          />
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-screen-lg w-full">
                        <div className="p-1">
                          <img 
                            src={imageUrl} 
                            alt="Generated from prompt" 
                            className="w-full h-auto object-contain"
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    <div className="mt-2 text-sm text-center text-muted-foreground">
                      Click the image to view full size
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
                  <span className="font-medium">About this test tool:</span> This page allows you to directly test the OpenAI image generation API to verify it's working properly with different models.
                </p>
                
                <p>
                  <span className="font-medium">Available Image Models:</span>
                </p>
                <div className="space-y-2 mt-2 ml-1">
                  <div className="flex items-start gap-2">
                    <Badge className="bg-green-600 mt-0.5">gpt-image-1</Badge>
                    <div className="text-sm">
                      <p className="font-medium">OpenAI's newest model (May 2025)</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Released in May 2025, this model provides higher quality images with better text rendering, 
                        improved consistency, and more accurate interpretation of prompts. Supports quality settings 
                        and transparent backgrounds.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <Badge className="bg-blue-600 mt-0.5">dall-e-3</Badge>
                    <div className="text-sm">
                      <p className="font-medium">Reliable high-quality model</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        OpenAI's established image generation model with excellent reliability. Used as a fallback 
                        when gpt-image-1 isn't available or encounters an error. Supports multiple image sizes.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <Badge className="bg-gray-600 mt-0.5">dall-e-2</Badge>
                    <div className="text-sm">
                      <p className="font-medium">Final fallback model</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Legacy model used as a last resort fallback if both newer models fail. Only used in rare 
                        cases of API errors or unavailability.
                      </p>
                    </div>
                  </div>
                </div>
                
                <p className="mt-4">
                  <span className="font-medium">Auto Selection Mode:</span> By default, the system will try to use gpt-image-1 
                  and fall back to dall-e-3 if needed. You can override this by explicitly selecting a model.
                </p>
                
                <div className="mt-2">
                  <span className="font-medium">Response time analysis:</span>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li><span className="font-medium text-green-600">5-15 seconds:</span> Real API call to OpenAI (expected)</li>
                    <li><span className="font-medium text-yellow-600">15+ seconds:</span> API call is likely real but experiencing high latency</li>
                    <li><span className="font-medium text-red-600">&lt;1 second:</span> Response is likely mocked or intercepted</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}