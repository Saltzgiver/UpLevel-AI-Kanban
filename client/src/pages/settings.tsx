import React, { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PageLayout } from "@/components/layout/page-layout";

/**
 * Settings page for configuring application settings
 */
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("developer");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [workflowPrompt, setWorkflowPrompt] = useState("");
  const [originalWorkflowPrompt, setOriginalWorkflowPrompt] = useState("");
  const { toast } = useToast();

  // Fetch current settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        setIsLoading(true);
        
        // Fetch workflow prompt
        const workflowPromptRes = await fetch("/api/settings/workflow_system_prompt");
        
        if (workflowPromptRes.ok) {
          const data = await workflowPromptRes.json();
          setWorkflowPrompt(data.value || "");
          setOriginalWorkflowPrompt(data.value || "");
        } else if (workflowPromptRes.status === 404) {
          // Setting doesn't exist yet, use default from server
          setWorkflowPrompt("");
          setOriginalWorkflowPrompt("");
        } else {
          throw new Error(`Failed to fetch workflow prompt: ${workflowPromptRes.statusText}`);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
        toast({
          title: "Error",
          description: "Failed to load settings",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, [toast]);

  // Save workflow prompt settings
  const handleSaveWorkflowPrompt = async () => {
    try {
      setIsSaving(true);

      const response = await apiRequest("POST", "/api/settings", {
        key: "workflow_system_prompt",
        value: workflowPrompt,
      });

      setOriginalWorkflowPrompt(workflowPrompt);
      
      toast({
        title: "Success",
        description: "Workflow prompt saved successfully!",
      });
    } catch (error) {
      console.error("Error saving workflow prompt:", error);
      toast({
        title: "Error",
        description: "Failed to save workflow prompt",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset workflow prompt to original value
  const handleResetWorkflowPrompt = () => {
    setWorkflowPrompt(originalWorkflowPrompt);
  };

  // Check if there are unsaved changes
  const hasWorkflowPromptChanges = workflowPrompt !== originalWorkflowPrompt;

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <Tabs defaultValue="developer" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="developer">Developer Tools</TabsTrigger>
          <TabsTrigger value="testing">Testing Tools</TabsTrigger>
          {/* Can add more tabs here in the future */}
        </TabsList>

        <TabsContent value="testing" className="mt-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>API Testing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-muted-foreground">
                  Access testing tools for various API features.
                </p>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-md font-medium mb-2">Image Generation API</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Test the OpenAI DALL-E image generation API directly to verify it's working properly and identify any issues.
                    </p>
                    <Button asChild>
                      <a href="/image-api-test">Open Image API Test</a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="developer" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Generator Prompt</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Customize the system prompt used by the AI to generate Kanban board columns based on workflow descriptions.
                  </p>
                  <Textarea
                    value={workflowPrompt}
                    onChange={(e) => setWorkflowPrompt(e.target.value)}
                    placeholder="Enter system prompt for workflow generation..."
                    className="min-h-[300px] font-mono text-sm"
                  />
                </>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={handleResetWorkflowPrompt}
                disabled={isLoading || !hasWorkflowPromptChanges}
              >
                Reset
              </Button>
              <Button 
                onClick={handleSaveWorkflowPrompt} 
                disabled={isLoading || isSaving || !hasWorkflowPromptChanges}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}