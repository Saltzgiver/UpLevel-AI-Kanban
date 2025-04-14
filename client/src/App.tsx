import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import { DndProvider } from "@/components/board/board";
import TestUploadPage from "@/pages/test-upload";
import TestSuggestionPage from "@/pages/test-suggestion";
import DirectToastTestPage from "@/pages/direct-toast-test";
import PromptAnalyzerSettings from "@/pages/prompt-analyzer-settings";
import { ModalProvider } from "@/contexts/ModalContext";
import { SuggestionListener } from "@/components/prompt-assistant/SuggestionListener";
import { GlobalAssignGPTModal } from "@/components/modals/GlobalAssignGPTModal";
import { PageLayout } from "@/components/layout/page-layout";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/test-upload" component={TestUploadPage} />
      <Route path="/test-suggestion" component={TestSuggestionPage} />
      <Route path="/direct-toast-test" component={DirectToastTestPage} />
      <Route path="/prompt-analyzer-settings" component={PromptAnalyzerSettings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ModalProvider>
        <DndProvider>
          <PageLayout>
            <Router />
          </PageLayout>
          {/* Add SuggestionListener to handle events from fetch interceptor */}
          <SuggestionListener />
          {/* Global modal for handling GPT assignment from anywhere, including suggestions */}
          <GlobalAssignGPTModal />
          <Toaster />
        </DndProvider>
      </ModalProvider>
    </QueryClientProvider>
  );
}

export default App;
