import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect, useRef } from "react";
import { Onboarding } from "@/components/Onboarding";
import { LockScreen } from "@/components/LockScreen";
import { isPinEnabled, isTimeoutExpired, setLastUnlocked, getTimeoutMinutes } from "@/lib/pin-security";

import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Budgets from "@/pages/Budgets";
import Accounts from "@/pages/Accounts";
import More from "@/pages/More";
import Recurring from "@/pages/Recurring";
import Goals from "@/pages/Goals";
import NetWorth from "@/pages/NetWorth";
import WeeklyCashflow from "@/pages/WeeklyCashflow";
import Reports from "@/pages/Reports";
import Setup from "@/pages/Setup";
import CalendarPage from "@/pages/Calendar";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/budgets" component={Budgets} />
      <Route path="/accounts" component={Accounts} />
      <Route path="/more" component={More} />
      <Route path="/recurring" component={Recurring} />
      <Route path="/goals" component={Goals} />
      <Route path="/net-worth" component={NetWorth} />
      <Route path="/weekly-cashflow" component={WeeklyCashflow} />
      <Route path="/reports" component={Reports} />
      <Route path="/setup" component={Setup} />
      <Route path="/calendar" component={CalendarPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [onboarded, setOnboarded] = useState(() => {
    if (localStorage.getItem('viniverse-seeded')) localStorage.setItem('viniverse-onboarded', 'true');
    return !!localStorage.getItem('viniverse-onboarded');
  });

  const [locked, setLocked] = useState(() => {
    return isPinEnabled() && isTimeoutExpired();
  });

  const hiddenAtRef = useRef<number | null>(null);

  // Listen for manual lock event (dispatched from More/Settings)
  useEffect(() => {
    const handler = () => {
      if (isPinEnabled()) setLocked(true);
    };
    window.addEventListener("viniverse:lock", handler);
    return () => window.removeEventListener("viniverse:lock", handler);
  }, []);

  // Lock on visibility change (tab hide/show)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
      } else if (document.visibilityState === "visible") {
        if (!isPinEnabled()) return;
        const timeout = getTimeoutMinutes();
        if (timeout === 0) {
          // "Immediately" — always lock when returning
          if (hiddenAtRef.current !== null) setLocked(true);
        } else if (isTimeoutExpired()) {
          setLocked(true);
        }
        hiddenAtRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const handleUnlock = () => {
    setLastUnlocked();
    setLocked(false);
  };

  if (!onboarded) return <Onboarding onComplete={() => setOnboarded(true)} />;

  // Show lock screen — do NOT render app behind it so financial data is hidden
  if (locked) return <LockScreen onUnlock={handleUnlock} />;

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
