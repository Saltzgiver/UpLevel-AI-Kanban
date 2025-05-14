import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ImageIcon, CheckCircle, AlertCircle } from 'lucide-react';

export default function ImageApiTest() {
  const [prompt, setPrompt] = useState('A beautiful mountain landscape with a lake');
  const [isLoading, setIsLoading] = useState(false);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    imageBase64?: string;
    imageUrl?: string;
    fileType?: string;
    error?: string;
    logs?: string[];
  } | null>(null);

  const { toast } = useToast();

  // Function to test the generateImage API directly
  const testGenerateImage = async () => {
    try {
      setIsLoading(true);
      setResult(null);
      setResponseTime(null);
      
      // Record start time
      const startTime = Date.now();
      
      // Call the server API endpoint
      const response = await fetch('/api/test/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });
      
      // Calculate response time
      const endTime = Date.now();
      const timeElapsed = (endTime - startTime) / 1000; // in seconds
      setResponseTime(timeElapsed);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate image');
      }
      
      const data = await response.json();
      setResult({
        success: true,
        imageBase64: data.base64,
        fileType: data.fileType,
        logs: data.logs || [],
      });
      
      toast({
        title: 'Image Generated Successfully',
        description: `Response time: ${timeElapsed.toFixed(2)} seconds`,
      });
    } catch (error) {
      console.error('Error testing image generation:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
      
      toast({
        title: 'Image Generation Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">OpenAI Image API Test</CardTitle>
          <CardDescription>
            Test the OpenAI DALL-E image generation API directly to verify it's working properly
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="prompt" className="text-sm font-medium">
              Image Prompt
            </label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to generate..."
              className="min-h-[100px]"
            />
          </div>
          
          <Button 
            onClick={testGenerateImage} 
            disabled={isLoading || !prompt.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Image...
              </>
            ) : (
              <>
                <ImageIcon className="mr-2 h-4 w-4" />
                Generate Image
              </>
            )}
          </Button>
          
          {responseTime !== null && (
            <div className="text-sm text-muted-foreground text-center">
              Response time: <span className="font-medium">{responseTime.toFixed(2)} seconds</span>
              {responseTime < 2 && (
                <div className="mt-1 text-amber-500 flex items-center justify-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  This response was too fast to be a real API call!
                </div>
              )}
              {responseTime >= 2 && (
                <div className="mt-1 text-green-500 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  This response time is consistent with a real API call
                </div>
              )}
            </div>
          )}
          
          {result && (
            <>
              <Separator className="my-4" />
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Result</h3>
                
                {result.success ? (
                  <div className="space-y-4">
                    <div className="rounded-md overflow-hidden border">
                      {result.imageBase64 && (
                        <img 
                          src={`data:${result.fileType};base64,${result.imageBase64}`}
                          alt="Generated image"
                          className="w-full object-contain max-h-[400px]"
                        />
                      )}
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      <div>File type: {result.fileType}</div>
                      <div>Base64 length: {result.imageBase64?.length || 0} characters</div>
                    </div>
                    
                    {result.logs && result.logs.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">Server Logs</h4>
                        <div className="bg-muted rounded-md p-3 text-xs font-mono overflow-auto max-h-[200px]">
                          {result.logs.map((log, index) => (
                            <div key={index} className="mb-1">{log}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-destructive">
                    <h4 className="font-medium">Error:</h4>
                    <p>{result.error}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}