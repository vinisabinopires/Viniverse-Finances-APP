import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <main className="max-w-md mx-auto w-full">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
