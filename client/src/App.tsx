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

// Use a custom route component to handle which routes should have the navigation bar
function CustomRoute({ component: Component, showNav = true, ...rest }: any) {
  return (
    <Route
      {...rest}
      component={(props: any) => (
        <PageLayout showNav={showNav}>
          <Component {...props} />
        </PageLayout>
      )}
    />
  );
}

function Router() {
  return (
    <Switch>
      {/* Home route doesn't need the default navigation bar, as it has its own */}
      <CustomRoute path="/" component={Home} showNav={false} />
      <CustomRoute path="/test-upload" component={TestUploadPage} />
      <CustomRoute path="/test-suggestion" component={TestSuggestionPage} />
      <CustomRoute path="/direct-toast-test" component={DirectToastTestPage} />
      <CustomRoute path="/prompt-analyzer-settings" component={PromptAnalyzerSettings} />
      <CustomRoute component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ModalProvider>
        <DndProvider>
          <Router />
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
