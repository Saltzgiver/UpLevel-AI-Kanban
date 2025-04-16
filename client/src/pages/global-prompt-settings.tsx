import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, RefreshCw, Info } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

/**
 * Page for managing the global prompt that is applied before column-specific prompts
 */
export default function GlobalPromptSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const { toast } = useToast();

  // Load the current global prompt setting on initial load
  useEffect(() => {
    const fetchGlobalPrompt = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/global-prompt');
        if (response.ok) {
          const data = await response.json();
          setGlobalPrompt(data.prompt || '');
          setOriginalPrompt(data.prompt || '');
        } else {
          // If the endpoint returns an error, load default values
          loadDefaultPrompt();
        }
      } catch (error) {
        console.error('Error fetching global prompt:', error);
        loadDefaultPrompt();
      } finally {
        setIsLoading(false);
      }
    };

    fetchGlobalPrompt();
  }, []);

  // Load default prompt if we can't fetch the current one
  const loadDefaultPrompt = () => {
    const defaultPrompt = `Focus on practical and actionable responses that help the user accomplish their task. Prioritize clarity and conciseness. Always directly address the user's specific needs without unnecessary elaboration.`;
    setGlobalPrompt(defaultPrompt);
    setOriginalPrompt(defaultPrompt);
  };

  // Reset to default prompt
  const resetToDefault = () => {
    if (confirm('Are you sure you want to reset to the default global prompt? Your customizations will be lost.')) {
      loadDefaultPrompt();
      toast({
        title: 'Prompt Reset',
        description: 'The global prompt has been reset to default values.',
      });
    }
  };

  // Save the current global prompt
  const saveGlobalPrompt = async () => {
    setIsSaving(true);
    try {
      const response = await apiRequest('POST', '/api/global-prompt', { prompt: globalPrompt });
      
      toast({
        title: 'Global Prompt Saved',
        description: 'The global prompt has been updated successfully.',
      });
      
      // Update the original prompt to match the current one
      setOriginalPrompt(globalPrompt);
    } catch (error) {
      console.error('Error saving global prompt:', error);
      toast({
        title: 'Error',
        description: 'Failed to save the global prompt. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = globalPrompt !== originalPrompt;

  return (
    <div className="container py-10">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Global Prompt Settings</CardTitle>
          <CardDescription>
            Configure the global prompt that will be applied before column-specific prompts.
            This prompt helps shape how all AI columns behave when processing cards.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Global Prompt Configuration</CardTitle>
          <CardDescription>
            This prompt will be applied to all AI-powered columns before their specific instructions.
            Use it to set global behavior, style, or requirements that should apply across all AI interactions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>How Global Prompts Work</AlertTitle>
                <AlertDescription>
                  This global prompt is inserted before each column's specific instructions.
                  It allows you to control AI behavior across all columns without editing each one individually.
                  For example, you can set a consistent tone, add standard requirements, or enforce particular constraints.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Textarea 
                  value={globalPrompt} 
                  onChange={(e) => setGlobalPrompt(e.target.value)}
                  placeholder="Enter global prompt instructions that will apply to all AI columns"
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  This prompt will be prepended to each column's specific instructions.
                </p>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={resetToDefault}
            disabled={isLoading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset to Default
          </Button>
          <Button
            onClick={saveGlobalPrompt}
            disabled={isLoading || isSaving || !hasUnsavedChanges}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}