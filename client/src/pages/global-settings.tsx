import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function GlobalSettingsPage() {
  const [globalPrompt, setGlobalPrompt] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Fetch current global prompt
  useEffect(() => {
    const fetchGlobalPrompt = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/settings/global_prompt`);
        if (response.ok) {
          const data = await response.json();
          setGlobalPrompt(data.value || "");
        } else if (response.status !== 404) { // It's okay if the setting doesn't exist yet
          console.error("Error fetching global prompt", response.statusText);
          toast({
            title: "Error",
            description: "Failed to load the global prompt. Please try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error fetching global prompt:", error);
        toast({
          title: "Connection Error",
          description: "Could not connect to the server. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchGlobalPrompt();
  }, [toast]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: "global_prompt",
          value: globalPrompt,
        }),
      });

      if (response.ok) {
        toast({
          title: "Settings saved",
          description: "Global prompt has been updated successfully.",
        });
        // Invalidate queries that might depend on this setting
        queryClient.invalidateQueries({ queryKey: ['/api/settings/global_prompt'] });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving global prompt:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Global Prompt Settings</h1>
      <p className="text-gray-600 mb-8">
        Configure a global prompt that will be applied to all AI interactions before column-specific instructions.
        This is useful for setting consistent guidelines across all columns.
      </p>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Global Prompt Configuration</CardTitle>
            <CardDescription>
              This prompt will run first, before any column-specific prompts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  placeholder="Enter a global prompt that will be applied to all AI interactions..."
                  value={globalPrompt}
                  onChange={(e) => setGlobalPrompt(e.target.value)}
                  rows={10}
                  className="min-h-[200px] resize-y"
                  disabled={isLoading}
                />
                <p className="text-sm text-gray-500">
                  Examples: "Always use a professional tone", "Format responses with bullet points when listing items", etc.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setGlobalPrompt("")}
              disabled={isLoading || isSaving || !globalPrompt}
            >
              Clear
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isLoading || isSaving}
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}