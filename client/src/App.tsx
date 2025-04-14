import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import { DndProvider } from "@/components/board/board";
import TestUploadPage from "@/pages/test-upload";
import { ModalProvider, useModalContext } from "@/contexts/ModalContext";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/test-upload" component={TestUploadPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Prompt suggestion event listener component
function PromptSuggestionListener() {
  const { toast } = useToast();
  const { openInSuggestionMode } = useModalContext();

  useEffect(() => {
    // Function to handle suggestion available events
    const handleSuggestionAvailable = (event: Event) => {
      const customEvent = event as CustomEvent<{columnId: number, cardId: number}>;
      const { columnId, cardId } = customEvent.detail;
      
      console.log(`[Prompt Assistant] Showing toast for suggestion for column ${columnId} from card ${cardId}`);
      
      // Show toast with action to open the suggestion modal
      toast({
        title: "Prompt Suggestion Available",
        description: `Based on your recent card, we have a suggestion to improve the column prompt.`,
        variant: "default",
        duration: 15000, // Show for 15 seconds
        action: (
          <button 
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2 rounded-md text-xs font-medium"
            onClick={() => {
              console.log(`[Prompt Assistant] Opening suggestion modal for column ${columnId}, card ${cardId}`);
              openInSuggestionMode(columnId, cardId);
            }}
          >
            Review
          </button>
        ),
      });
    };

    // Add event listener for our custom event
    window.addEventListener('promptSuggestionAvailable', handleSuggestionAvailable);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('promptSuggestionAvailable', handleSuggestionAvailable);
    };
  }, [toast, openInSuggestionMode]);

  return null; // This component doesn't render anything
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ModalProvider>
        <DndProvider>
          <Router />
          <PromptSuggestionListener />
          <Toaster />
        </DndProvider>
      </ModalProvider>
    </QueryClientProvider>
  );
}

export default App;
