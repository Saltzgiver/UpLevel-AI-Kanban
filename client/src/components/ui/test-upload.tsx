import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function TestUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    console.log("Files selected:", files ? files.length : 0);
    
    if (!files || files.length === 0) return;
    
    await uploadFile(files[0]);
    
    // Clear the input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setResult(null);
    
    try {
      console.log(`Preparing to upload test file: ${file.name} (${file.type}, ${Math.round(file.size/1024)}KB)`);
      
      const formData = new FormData();
      formData.append('files', file);
      
      console.log("Sending test upload request");
      
      const response = await fetch('/api/test-upload', {
        method: 'POST',
        body: formData,
      });
      
      console.log(`Response status: ${response.status} ${response.statusText}`);
      
      const data = await response.json();
      console.log("Response data:", data);
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to upload file');
      }
      
      setResult(data);
      
      toast({
        title: "Success",
        description: "File uploaded successfully in test mode",
      });
    } catch (error) {
      console.error("Error in test upload:", error);
      
      setResult({ error: error instanceof Error ? error.message : String(error) });
      
      toast({
        title: "Error",
        description: `Test upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Test File Upload</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input 
              type="file"
              ref={fileInputRef} 
              onChange={handleFileChange}
              className="hidden" 
              disabled={isUploading}
            />
            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Select file for test upload'
              )}
            </Button>
          </div>
          
          {result && (
            <div className="mt-4 p-4 bg-gray-50 rounded-md border">
              <h3 className="text-sm font-medium mb-2">Result:</h3>
              <pre className="text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}