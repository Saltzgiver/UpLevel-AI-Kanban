import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import { DndProvider } from "@/components/board/board";
import TestUploadPage from "@/pages/test-upload";
import { ModalProvider } from "@/contexts/ModalContext";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/test-upload" component={TestUploadPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ModalProvider>
        <DndProvider>
          <Router />
          <Toaster />
        </DndProvider>
      </ModalProvider>
    </QueryClientProvider>
  );
}

export default App;
