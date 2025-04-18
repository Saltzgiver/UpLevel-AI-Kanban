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
    const columnId = 21; // "Image" column
    const cardId = 86; // "sheet test" card
    
    console.log(`Triggering toast with modal action for column ${columnId}, card ${cardId}`);
    toast({
      title: "Prompt Assistant",
      description: `We have suggestions to improve the "Image Column" column's instructions based on recent card activity.`,
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
      
      // Verify the suggestion was created with improved error handling
      try {
        const checkResponse = await fetch(`/api/columns/${columnId}/prompt-suggestion/check/${cardId}`);
        
        // Check if response is OK before trying to parse JSON
        if (!checkResponse.ok) {
          throw new Error(`Server responded with ${checkResponse.status}: ${checkResponse.statusText}`);
        }

        // Get response content type
        const contentType = checkResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('Error: Expected JSON response but received:', contentType);
          
          // Try to get the text content for debugging
          const textContent = await checkResponse.text();
          console.error('Response content (not JSON):', textContent.substring(0, 500) + '...');
          
          throw new Error('Invalid response format: expected JSON');
        }
        
        // Now safe to parse JSON
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
                try {
                  // First create a test suggestion
                  console.log('Creating test suggestion for column 9, card 47');
                  const createResponse = await fetch('/api/columns/9/prompt-suggestion/create-test/47', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      suggestion: {
                        rationale: 'This is a comprehensive test suggestion created via the full E2E test.',
                        suggestedInstructions: 'Create an image based on the card content with attention to style (photorealistic, cartoon, etc.) and composition details.',
                      },
                    }),
                  });
                  
                  if (!createResponse.ok) {
                    throw new Error('Failed to create test suggestion');
                  }
                  
                  const createResult = await createResponse.json();
                  console.log('Test suggestion created successfully:', createResult);
                  
                  // Then verify it with the check endpoint
                  console.log('Verifying suggestion with /check endpoint');
                  const checkResponse = await fetch('/api/columns/9/prompt-suggestion/check/47');
                  
                  if (!checkResponse.ok) {
                    throw new Error(`Check failed with status ${checkResponse.status}`);
                  }
                  
                  const checkResult = await checkResponse.json();
                  console.log('Check result:', checkResult);
                  
                  // If check passes, show the toast
                  if (checkResult.hasSuggestion) {
                    console.log('Suggestion verified, showing toast...');
                    toast({
                      title: "Prompt Assistant",
                      description: "We have suggestions for the 'image test' column's instructions",
                      action: (
                        <ToastAction 
                          altText="View suggestion" 
                          onClick={() => {
                            console.log('Opening suggestion modal from toast');
                            openInSuggestionMode(9, 47);
                          }}
                        >
                          View
                        </ToastAction>
                      ),
                      duration: 10000,
                    });
                  } else {
                    toast({
                      title: "Test Failed",
                      description: "Suggestion created but verification failed",
                      variant: "destructive",
                    });
                  }
                } catch (error) {
                  console.error('E2E test failed:', error);
                  toast({
                    title: "Test Failed",
                    description: error instanceof Error ? error.message : "Unknown error",
                    variant: "destructive",
                  });
                }
              }}
              variant="default"
              className="w-full mb-2 bg-green-600 hover:bg-green-700"
            >
              E2E Test: Create + Verify + Show
            </Button>
            <p className="text-xs text-muted-foreground">Runs a full end-to-end test: create suggestion, verify it, then show toast with modal</p>
          </div>
          
          <div>
            <Button
              onClick={async () => {
                const columnId = 21; // "Image" column
                const cardId = 86; // "sheet test" card
                
                try {
                  // Create a test suggestion with do's and don'ts structured format
                  console.log(`Creating test suggestion with structured do's and don'ts for column ${columnId}, card ${cardId}`);
                  const structuredInstructions = `DO'S:
- Use clear, vibrant colors in all image generations
- Maintain consistent lighting across the entire image
- Add detailed textures to create a sense of realism
- Follow the composition guidelines specified in the request

DON'TS:
- Generate images with blurry or pixelated elements
- Create unrealistic lighting or shadow effects
- Distort human facial features unless specifically requested
- Ignore specific style instructions in the prompt`;
                  
                  const createResponse = await fetch(`/api/columns/${columnId}/prompt-suggestion/create-test/${cardId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      suggestion: {
                        rationale: 'Based on the analysis of recent image generation requests, we\'ve identified specific areas where prompt instructions can be improved to ensure consistent, high-quality outputs.',
                        suggestedInstructions: structuredInstructions,
                      },
                    }),
                  });
                  
                  if (!createResponse.ok) {
                    const errorText = await createResponse.text();
                    console.error(`Server responded with status ${createResponse.status}:`, errorText);
                    throw new Error(`Failed to create test suggestion with structured format: ${createResponse.status} ${createResponse.statusText}`);
                  }
                  
                  // Log success and trigger the custom event to test the enhanced toast
                  console.log('Successfully created structured suggestion, triggering custom event');
                  
                  // Create and dispatch the custom event
                  const event = new CustomEvent('promptAssistantSuggestion', { 
                    detail: { 
                      columnId: columnId, 
                      cardId: cardId,
                      columnName: 'Image Column' 
                    } 
                  });
                  
                  window.dispatchEvent(event);
                  console.log('Custom event dispatched to test enhanced toast');
                  
                } catch (error) {
                  console.error('Test for enhanced toast failed:', error);
                  toast({
                    title: "Enhanced Toast Test Failed",
                    description: error instanceof Error ? error.message : "Unknown error",
                    variant: "destructive",
                  });
                }
              }}
              variant="default"
              className="w-full mb-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              Test Enhanced Toast with Do's & Don'ts
            </Button>
            <p className="text-xs text-muted-foreground">Creates a suggestion with structured do's and don'ts and triggers the enhanced toast display</p>
          </div>
          
          <div>
            <Button 
              onClick={async () => {
                const columnId = 21; // "Image" column
                const cardId = 86; // "sheet test" card
                
                try {
                  console.log(`Checking suggestion for column ${columnId}, card ${cardId}`);
                  const checkResponse = await fetch(`/api/columns/${columnId}/prompt-suggestion/check/${cardId}`);
                  
                  // Check response status and content type before parsing
                  if (!checkResponse.ok) {
                    const errorText = await checkResponse.text();
                    console.error(`Error ${checkResponse.status}: ${checkResponse.statusText}`, errorText.substring(0, 200));
                    throw new Error(`Server responded with status ${checkResponse.status}`);
                  }
                  
                  // Verify content type
                  const contentType = checkResponse.headers.get('content-type');
                  if (!contentType || !contentType.includes('application/json')) {
                    const errorText = await checkResponse.text();
                    console.error('Response is not JSON:', contentType);
                    console.error('Response content (truncated):', errorText.substring(0, 500));
                    
                    // Try to create a test suggestion first and then retry
                    console.log('Creating a test suggestion before checking again...');
                    const createTestResponse = await fetch(`/api/columns/${columnId}/prompt-suggestion/create-test/${cardId}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        suggestion: {
                          rationale: 'This is a test suggestion created due to a fetch error.',
                          suggestedInstructions: 'Create an image based on the card content with attention to style (photorealistic, cartoon, etc.) and composition details.',
                        },
                      }),
                    });
                    
                    if (!createTestResponse.ok) {
                      throw new Error('Failed to create test suggestion as fallback');
                    }
                    
                    const createResult = await createTestResponse.json();
                    console.log('Test suggestion created:', createResult);
                    
                    // Now try checking again
                    const retryResponse = await fetch(`/api/columns/${columnId}/prompt-suggestion/check/${cardId}`);
                    if (!retryResponse.ok) {
                      throw new Error('Retry also failed');
                    }
                    
                    const retryContentType = retryResponse.headers.get('content-type');
                    if (!retryContentType || !retryContentType.includes('application/json')) {
                      throw new Error('Retry response is still not JSON');
                    }
                    
                    const retryResult = await retryResponse.json();
                    console.log('Retry suggestion check result:', retryResult);
                    
                    toast({
                      title: "Recovery Attempt",
                      description: "Created a test suggestion after error, check console for details",
                      variant: "default",
                      duration: 5000,
                    });
                    
                    return; // Exit early
                  }
                  
                  // Parse JSON response safely
                  const checkResult = await checkResponse.json();
                  console.log('Suggestion check result:', checkResult);
                  
                  if (checkResult.hasSuggestion) {
                    console.log('Suggestion exists, fetching content...');
                    // Use fetch with error handling instead of apiRequest for better debugging
                    const getResponse = await fetch(`/api/columns/${columnId}/prompt-suggestion/${cardId}`);
                    
                    // Check content type again
                    if (!getResponse.ok) {
                      throw new Error(`Failed to fetch suggestion content: ${getResponse.status}`);
                    }
                    
                    const contentType = getResponse.headers.get('content-type');
                    if (!contentType || !contentType.includes('application/json')) {
                      const errorText = await getResponse.text();
                      console.error('Content response is not JSON:', contentType);
                      console.error('Content (truncated):', errorText.substring(0, 500));
                      throw new Error('Content response is not JSON');
                    }
                    
                    const getResult = await getResponse.json();
                    console.log('Suggestion content:', getResult);
                    
                    toast({
                      title: "Debug Info",
                      description: "Suggestion info logged to console",
                    });
                  } else {
                    console.log('No suggestion available, creating a test one...');
                    // Create a test suggestion when none exists
                    const createTestResponse = await fetch(`/api/columns/${columnId}/prompt-suggestion/create-test/${cardId}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        suggestion: {
                          rationale: 'This is a test suggestion created because none was found.',
                          suggestedInstructions: 'Create an image based on the card content with attention to style (photorealistic, cartoon, etc.) and composition details.',
                        },
                      }),
                    });
                    
                    const createResult = await createTestResponse.json();
                    console.log('Test suggestion created:', createResult);
                    
                    toast({
                      title: "Debug Info",
                      description: "Created a test suggestion since none was available",
                      variant: "default",
                    });
                  }
                } catch (error) {
                  console.error('Error checking suggestion:', error);
                  toast({
                    title: 'Error',
                    description: 'Failed to check suggestion: ' + (error instanceof Error ? error.message : 'Unknown error'),
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