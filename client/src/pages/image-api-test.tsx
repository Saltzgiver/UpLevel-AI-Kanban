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
      const response = await fetch("/api/image-generation/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          prompt, 
          size: imageSize,
          model: selectedModel,
          quality: imageQuality
        }),
      });

      // Calculate response time
      const endTime = Date.now();
      const timeElapsed = (endTime - startTime) / 1000; // in seconds
      setResponseTime(timeElapsed);

      if (!response.ok) {
        const errorData = await response.json();
        console.log("API Error Details:", errorData);
        
        // Show more detailed error information
        const errorDetails = errorData.details ? 
          `\nDetails: ${errorData.details.substring(0, 150)}` : '';
        const requestInfo = errorData.requestDetails ? 
          `\nRequest: Model=${errorData.requestDetails.model}, Quality=${errorData.requestDetails.quality}` : '';
          
        throw new Error(`${errorData.error || "Failed to generate image"}${errorDetails}${requestInfo}`);
      }

      const data = await response.json();
      console.log("API Success Response:", data);
      console.log("API Debug Info:", data.debugInfo);
      
      // Set result data
      setImageUrl(data.url || data.base64);
      setModelInfo(data.model || "unknown");
      setResultType("success");
      
      // Store debug info for display
      setApiDebugInfo({
        openaiRequest: {
          model: selectedModel,
          prompt: prompt.substring(0, 30) + (prompt.length > 30 ? "..." : ""),
          size: imageSize,
          quality: imageQuality !== "auto" ? imageQuality : undefined,
          n: 1
        },
        openaiResponse: {
          actualModel: data.model,
          responseTime: data.responseTimeSeconds,
          base64Length: data.debugInfo?.base64Length || "unknown",
          ...data.debugInfo
        },
        exactApiRequest: {
          model: selectedModel,
          size: imageSize,
          quality: imageQuality,
          requestTimestamp: new Date().toISOString()
        },
        exactApiResponse: data
      });
      
      // Show more detailed success information
      const modelUsed = data.model || "unknown";
      const requestedModel = data.debugInfo?.requestedModel || selectedModel;
      const actualModel = data.debugInfo?.actualModel || modelUsed;
      
      toast({
        title: "Success",
        description: `Image generated in ${timeElapsed.toFixed(1)} seconds using ${actualModel} ${requestedModel !== actualModel ? `(requested: ${requestedModel})` : ''}`,
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Image Size</label>
                  <div className="flex flex-wrap gap-2">
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
                  <label className="block text-sm font-medium mb-1">Image Model</label>
                  <TooltipProvider>
                    <div className="flex flex-col space-y-3">
                      <RadioGroup value={selectedModel} onValueChange={(val) => setSelectedModel(val as any)} className="flex flex-col space-y-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="auto" id="auto" />
                          <Label htmlFor="auto" className="flex items-center gap-2">
                            Auto (Recommended)
                            <Badge variant="outline" className="ml-2 text-xs">Default</Badge>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-4 w-4 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="w-[200px]">Tries the newest model first (gpt-image-1) with fallback to dall-e-3 if needed</p>
                              </TooltipContent>
                            </Tooltip>
                          </Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="gpt-image-1" id="gpt-image-1" />
                          <Label htmlFor="gpt-image-1" className="flex items-center gap-2">
                            gpt-image-1
                            <Badge className="ml-2 text-xs bg-green-600 hover:bg-green-700">Newest</Badge>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-4 w-4 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="w-[200px]">OpenAI's newest model released May 2025 with higher quality and better understanding</p>
                              </TooltipContent>
                            </Tooltip>
                          </Label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="dall-e-3" id="dall-e-3" />
                          <Label htmlFor="dall-e-3" className="flex items-center gap-2">
                            dall-e-3
                            <Badge variant="secondary" className="ml-2 text-xs">Stable</Badge>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-4 w-4 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="w-[200px]">Widely available and reliable image generation model</p>
                              </TooltipContent>
                            </Tooltip>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </TooltipProvider>
                </div>
              </div>
              
              {selectedModel === "gpt-image-1" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Image Quality (gpt-image-1 only)</label>
                  <RadioGroup value={imageQuality} onValueChange={(val) => setImageQuality(val as any)} className="flex space-x-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="auto" id="q-auto" />
                      <Label htmlFor="q-auto">Auto</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="low" id="q-low" />
                      <Label htmlFor="q-low">Low</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="medium" id="q-medium" />
                      <Label htmlFor="q-medium">Medium</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="high" id="q-high" />
                      <Label htmlFor="q-high">High</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
              
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
              
              {/* API Debug Information Section */}
              <div className="mt-4 border border-gray-200 dark:border-gray-800 rounded-md p-3">
                <h3 className="text-sm font-medium mb-2 flex items-center">
                  <Info className="w-4 h-4 mr-1" />
                  API Request Details
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="col-span-2 mb-2">
                    <div className="font-semibold">Request Parameters:</div>
                    <pre className="whitespace-pre-wrap bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs mt-1">
                      {JSON.stringify({
                        prompt: prompt.substring(0, 30) + (prompt.length > 30 ? "..." : ""),
                        model: selectedModel,
                        size: imageSize,
                        quality: imageQuality
                      }, null, 2)}
                    </pre>
                  </div>
                  
                  {apiDebugInfo && (
                    <div className="col-span-2">
                      <div className="font-semibold">API Response Info:</div>
                      <pre className="whitespace-pre-wrap bg-gray-100 dark:bg-gray-900 p-2 rounded text-xs mt-1">
                        {JSON.stringify(apiDebugInfo, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
              
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
                    <h3 className="text-sm font-medium mb-1">Request Information</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="font-medium">Response Time:</span> {responseTime?.toFixed(2)}s
                      </div>
                      <div>
                        <span className="font-medium">Image Size:</span> {imageSize}
                      </div>
                      
                      <div className="col-span-2 mt-2">
                        <span className="font-medium text-sm">Model Details</span>
                        <div className="flex items-center mt-1 gap-2">
                          <Badge 
                            className={
                              modelInfo === "gpt-image-1" 
                                ? "bg-green-600" 
                                : modelInfo === "dall-e-3" 
                                  ? "bg-blue-600"
                                  : "bg-gray-600"
                            }
                          >
                            {modelInfo || "unknown"}
                          </Badge>
                          
                          <span className="text-xs text-muted-foreground">
                            {modelInfo === "gpt-image-1" 
                              ? "OpenAI's newest model (May 2025)" 
                              : modelInfo === "dall-e-3" 
                                ? "OpenAI's reliable high-quality model"
                                : modelInfo === "dall-e-2"
                                  ? "Final fallback model" 
                                  : ""}
                          </span>
                        </div>
                      </div>
                      
                      <div className="col-span-2 mt-2">
                        <span className="font-medium">Requested Configuration:</span>
                        <div className="mt-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span>Model:</span> 
                            <Badge variant="outline" className="text-xs">
                              {selectedModel}
                            </Badge>
                            
                            {selectedModel !== modelInfo && modelInfo && (
                              <span className="text-amber-600 text-xs flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Fallback was used
                              </span>
                            )}
                          </div>
                          
                          {selectedModel === "gpt-image-1" && (
                            <div className="flex items-center gap-2">
                              <span>Quality:</span> 
                              <Badge variant="outline" className="text-xs">
                                {imageQuality}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="col-span-2 mt-2">
                        <span className="font-medium">Technical Details:</span>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Badge variant="secondary" className="text-xs">
                            Format: {imageUrl.startsWith('data:') ? 'Base64 Data URL' : 'HTTP URL'}
                          </Badge>
                          
                          {imageUrl.startsWith('data:') && (
                            <Badge variant="secondary" className="text-xs">
                              MIME: {imageUrl.split(';')[0].split(':')[1]}
                            </Badge>
                          )}
                          
                          <Badge variant="secondary" className="text-xs">
                            Size: ~{Math.round(imageUrl.length / 1024)}KB
                          </Badge>
                        </div>
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
              
              <p className="mt-2">
                <span className="font-medium">Response time analysis:</span>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><span className="font-medium text-green-600">5-15 seconds:</span> Real API call to OpenAI (expected)</li>
                  <li><span className="font-medium text-yellow-600">15+ seconds:</span> API call is likely real but experiencing high latency</li>
                  <li><span className="font-medium text-red-600">&lt;1 second:</span> Response is likely mocked or intercepted</li>
                </ul>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}