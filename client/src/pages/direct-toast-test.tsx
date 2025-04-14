import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useModalContext } from '@/contexts/ModalContext';

/**
 * Direct Toast Test Page
 * 
 * This page allows testing the toast notifications with action buttons directly
 * without relying on the custom event system.
 */
export default function DirectToastTestPage() {
  const { toast } = useToast();
  const { openInSuggestionMode } = useModalContext();
  
  const triggerRegularToast = () => {
    console.log('Triggering regular toast');
    toast({
      title: "Regular Toast",
      description: "This is a regular toast without any action buttons.",
      duration: 5000,
    });
  };
  
  const triggerActionToast = () => {
    console.log('Triggering toast with action button');
    toast({
      title: "Toast with Action",
      description: "This toast has an action button that can be clicked.",
      action: (
        <ToastAction 
          altText="Click me" 
          onClick={() => {
            console.log('Action button clicked!');
            alert('Action button clicked!');
          }}
        >
          Click Me
        </ToastAction>
      ),
      duration: 10000,
    });
  };
  
  const triggerModalToast = () => {
    const columnId = 9; // "image test" column
    const cardId = 47; // "Image Generation Test" card
    
    console.log(`Triggering toast with modal action for column ${columnId}, card ${cardId}`);
    toast({
      title: "Prompt Assistant",
      description: `We have suggestions to improve the "Test Column" column's instructions based on recent card activity.`,
      action: (
        <ToastAction 
          altText="View suggestion" 
          onClick={() => {
            console.log(`View button clicked for column ${columnId}, card ${cardId}`);
            openInSuggestionMode(columnId, cardId);
          }}
        >
          View
        </ToastAction>
      ),
      duration: 10000,
    });
  };
  
  const createSuggestionAndTriggerToast = async () => {
    const columnId = 9; // "image test" column
    const cardId = 47; // "Image Generation Test" card
    
    try {
      // First create a test suggestion
      console.log(`Creating test suggestion for column ${columnId}, card ${cardId}`);
      const createResponse = await fetch(`/api/columns/${columnId}/prompt-suggestion/create-test/${cardId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suggestion: {
            rationale: 'Based on recent image generation results, adding more specific details about style and composition yields better results.',
            suggestedInstructions: 'Create an image based on the card content with attention to style (photorealistic, cartoon, etc.) and composition details.',
          },
        }),
      });
      
      const result = await createResponse.json();
      console.log('Suggestion created:', result);
      
      // Verify the suggestion was created
      try {
        const checkResponse = await fetch(`/api/columns/${columnId}/prompt-suggestion/check/${cardId}`);
        const checkResult = await checkResponse.json();
        console.log('Suggestion check after creation:', checkResult);
        
        if (!checkResult.hasSuggestion) {
          console.log('Warning: Suggestion check failed after creation');
        }
      } catch (error) {
        console.error('Error verifying suggestion:', error);
      }
      
      // Then show the toast
      console.log(`Triggering toast with modal action for column ${columnId}, card ${cardId}`);
      toast({
        title: "Prompt Assistant",
        description: `We have suggestions to improve the "Test Column" column's instructions based on recent card activity.`,
        action: (
          <ToastAction 
            altText="View suggestion" 
            onClick={() => {
              console.log(`View button clicked for column ${columnId}, card ${cardId}`);
              
              // Enhanced debugging for modal opening
              console.log('Modal state before opening:', { columnId, cardId, isSuggestionMode: true });
              openInSuggestionMode(columnId, cardId);
              
              // Log modal status
              setTimeout(() => {
                const modalState = document.querySelector('.fixed.inset-0.bg-black\\/40');
                console.log('Modal visible in DOM after toast action:', !!modalState);
              }, 500);
            }}
          >
            View
          </ToastAction>
        ),
        duration: 10000,
      });
    } catch (error) {
      console.error('Error creating suggestion:', error);
      toast({
        title: 'Error',
        description: 'Failed to create suggestion',
        variant: 'destructive',
      });
    }
  };
  
  return (
    <div className="container max-w-3xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Direct Toast Testing</CardTitle>
          <CardDescription>Test toast notifications with action buttons directly</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Button onClick={triggerRegularToast} className="w-full mb-2">
              Show Regular Toast
            </Button>
            <p className="text-xs text-muted-foreground">Displays a basic toast without action buttons</p>
          </div>
          
          <div>
            <Button onClick={triggerActionToast} className="w-full mb-2">
              Show Toast with Action
            </Button>
            <p className="text-xs text-muted-foreground">Displays a toast with a "Click Me" action button that shows an alert</p>
          </div>
          
          <div>
            <Button onClick={createSuggestionAndTriggerToast} variant="default" className="w-full mb-2">
              Create Suggestion and Show Toast
            </Button>
            <p className="text-xs text-muted-foreground">Creates a suggestion first, then displays a toast with a "View" action button that opens the modal</p>
          </div>
          
          <div>
            <Button 
              onClick={() => {
                console.log('Directly opening modal in suggestion mode for column 9, card 47');
                openInSuggestionMode(9, 47);
                
                // Log the modal state after a slight delay to ensure state has updated
                setTimeout(() => {
                  const modalState = document.querySelector('.fixed.inset-0.bg-black\\/40');
                  console.log('Modal visible in DOM:', !!modalState);
                }, 500);
              }} 
              variant="outline" 
              className="w-full mb-2"
            >
              Open GPT Modal Directly
            </Button>
            <p className="text-xs text-muted-foreground">Opens the GPT modal directly in suggestion mode for column 9, card 47</p>
          </div>
          
          <div>
            <Button onClick={triggerModalToast} variant="outline" className="w-full mb-2">
              Show Toast Without Creating Suggestion
            </Button>
            <p className="text-xs text-muted-foreground">Shows a toast with "View" button without creating a suggestion first</p>
          </div>
          
          <div>
            <Button 
              onClick={async () => {
                const columnId = 9; // "image test" column
                const cardId = 47; // "Image Generation Test" card
                
                try {
                  console.log(`Checking suggestion for column ${columnId}, card ${cardId}`);
                  const checkResponse = await fetch(`/api/columns/${columnId}/prompt-suggestion/check/${cardId}`);
                  const checkResult = await checkResponse.json();
                  console.log('Suggestion check result:', checkResult);
                  
                  if (checkResult.hasSuggestion) {
                    console.log('Suggestion exists, fetching content...');
                    const getResponse = await fetch(`/api/columns/${columnId}/prompt-suggestion/${cardId}`);
                    const getResult = await getResponse.json();
                    console.log('Suggestion content:', getResult);
                    
                    toast({
                      title: "Debug Info",
                      description: "Suggestion info logged to console",
                    });
                  } else {
                    console.log('No suggestion available');
                    toast({
                      title: "Debug Info",
                      description: "No suggestion available",
                      variant: "destructive",
                    });
                  }
                } catch (error) {
                  console.error('Error checking suggestion:', error);
                  toast({
                    title: 'Error',
                    description: 'Failed to check suggestion',
                    variant: 'destructive',
                  });
                }
              }} 
              variant="secondary" 
              className="w-full mb-2"
            >
              Debug: Check Suggestion Directly
            </Button>
            <p className="text-xs text-muted-foreground">Checks if suggestion exists and logs content to console</p>
          </div>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            This page is for testing the toast action buttons directly.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}