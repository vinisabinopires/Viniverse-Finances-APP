import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState } from "react";
import { Onboarding } from "@/components/Onboarding";

import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Accounts from "@/pages/Accounts";
import More from "@/pages/More";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/accounts" component={Accounts} />
      <Route path="/more" component={More} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [onboarded, setOnboarded] = useState(() => {
    // Migrate users who went through the old seed flow
    if (localStorage.getItem('viniverse-seeded')) {
      localStorage.setItem('viniverse-onboarded', 'true');
    }
    return !!localStorage.getItem('viniverse-onboarded');
  });

  if (!onboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
