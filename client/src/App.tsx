import { Switch, Route, Router as WouterRouter } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import TranslatorPage from "./pages/TranslatorPage";
import HistoryPage from "./pages/HistoryPage";
import PhrasesPage from "./pages/PhrasesPage";
import NotFound from "./pages/not-found";
import { ThemeProvider } from "./components/ThemeProvider";

function Router() {
  return (
    <WouterRouter hook={useHashLocation}>
      <Switch>
        <Route path="/" component={TranslatorPage} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/phrases" component={PhrasesPage} />
        <Route component={NotFound} />
      </Switch>
    </WouterRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
