import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, Loader2 } from 'lucide-react';

/**
 * Test page for the Prompt Assistant functionality
 * This page allows testing the suggestion creation, notification, and retrieval
 */
export default function TestSuggestionPage() {
  const [columnId, setColumnId] = useState('9'); // Default "image test" column
  const [cardId, setCardId] = useState('47'); // Default "Image Generation Test" card
  const [rationale, setRationale] = useState(
    'Based on recent image generation results, we noticed that adding more specific details about the desired style and composition yields better results.'
  );
  const [suggestedInstructions, setSuggestedInstructions] = useState(
    'Generate a detailed image based on the card title and description. Include specific style guidance (photorealistic, cartoon, watercolor, etc.) and composition details (close-up, landscape, portrait, etc.) in your response.'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [responseData, setResponseData] = useState<any>(null);
  const { toast } = useToast();

  const createSuggestion = async () => {
    setIsLoading(true);
    try {
      // Create a test suggestion using the API
      const createResponse = await fetch(`/api/columns/${columnId}/prompt-suggestion/create-test/${cardId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suggestion: {
            rationale,
            suggestedInstructions,
          },
        }),
      });

      const createResult = await createResponse.json();
      setResponseData(createResult);

      // Manually dispatch the custom event to trigger the SuggestionListener
      console.log(`[Test Page] Manually dispatching promptAssistantSuggestion event for column ${columnId}, card ${cardId}`);
      const event = new CustomEvent('promptAssistantSuggestion', {
        detail: {
          columnId: parseInt(columnId),
          cardId: parseInt(cardId),
          columnName: 'Test Column'
        }
      });
      window.dispatchEvent(event);
      console.log('[Test Page] Custom event dispatched');

      toast({
        title: 'Suggestion Created',
        description: 'Test suggestion has been created and event dispatched. Watch for the toast notification from the SuggestionListener.',
      });
    } catch (error) {
      console.error('Error creating suggestion:', error);
      toast({
        title: 'Error',
        description: 'Failed to create test suggestion',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkSuggestionStatus = async () => {
    setIsLoading(true);
    try {
      // Check if a suggestion is available using the API
      const response = await fetch(`/api/columns/${columnId}/prompt-suggestion/status/${cardId}`);
      const data = await response.json();
      setResponseData(data);

      toast({
        title: 'Suggestion Status',
        description: data.hasSuggestion ? 'Suggestion is available' : 'No suggestion available',
      });
    } catch (error) {
      console.error('Error checking suggestion status:', error);
      toast({
        title: 'Error',
        description: 'Failed to check suggestion status',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getSuggestion = async () => {
    setIsLoading(true);
    try {
      // Get the suggestion content using the API
      const response = await fetch(`/api/columns/${columnId}/prompt-suggestion/${cardId}`);
      const data = await response.json();
      setResponseData(data);

      toast({
        title: 'Suggestion Retrieved',
        description: data.suggestion ? 'Suggestion content has been retrieved' : 'No suggestion available',
      });
    } catch (error) {
      console.error('Error getting suggestion:', error);
      toast({
        title: 'Error',
        description: 'Failed to get suggestion content',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-3xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Prompt Assistant Test</CardTitle>
          <CardDescription>Test the Prompt Assistant suggestion functionality</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="column-id">Column ID</Label>
              <Input
                id="column-id"
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                placeholder="Column ID (e.g., 9)"
              />
              <p className="text-xs text-muted-foreground">Default: 9 (image test)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-id">Card ID</Label>
              <Input
                id="card-id"
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                placeholder="Card ID (e.g., 47)"
              />
              <p className="text-xs text-muted-foreground">Default: 47 (Image Generation Test)</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="rationale">Suggestion Rationale</Label>
            <Textarea
              id="rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Enter the rationale for the suggestion"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Suggested Instructions</Label>
            <Textarea
              id="instructions"
              value={suggestedInstructions}
              onChange={(e) => setSuggestedInstructions(e.target.value)}
              placeholder="Enter the suggested instructions"
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Button onClick={createSuggestion} disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                1. Create Test Suggestion
              </Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={checkSuggestionStatus} disabled={isLoading} variant="outline" className="w-full">
                2. Check Suggestion Status
              </Button>
              <Button onClick={getSuggestion} disabled={isLoading} variant="outline" className="w-full">
                3. Get Suggestion Content
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-medium mb-2">Testing Instructions:</h3>
            <ol className="text-sm space-y-1 list-decimal pl-5">
              <li>Create a test suggestion using the button above</li>
              <li>Watch for the toast notification from the SuggestionListener component</li>
              <li>Click "View" on the toast notification to open the suggestion modal</li>
              <li>Try accepting or rejecting the suggestion in the modal</li>
            </ol>
          </div>

          {responseData && (
            <div className="mt-4 p-4 bg-gray-50 rounded-md">
              <h3 className="text-sm font-medium mb-2">API Response:</h3>
              <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-60">
                {JSON.stringify(responseData, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            This page is for testing the end-to-end functionality of the Prompt Assistant feature.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}