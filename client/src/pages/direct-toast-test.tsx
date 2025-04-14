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
            <Button onClick={triggerModalToast} variant="default" className="w-full mb-2">
              Show Suggestion Toast
            </Button>
            <p className="text-xs text-muted-foreground">Displays a toast with a "View" action button that opens the modal</p>
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