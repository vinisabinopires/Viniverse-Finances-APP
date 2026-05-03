import { Link, useLocation } from "wouter";
import { Home, List, CreditCard, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/transactions", icon: List, label: "Transactions" },
    { href: "/accounts", icon: CreditCard, label: "Accounts" },
    { href: "/more", icon: Menu, label: "More" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-t border-white/10 pb-safe">
      <nav className="flex justify-around items-center h-16 max-w-md mx-auto relative px-2">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex-1 flex flex-col items-center justify-center py-2 relative touch-manipulation">
              <div className={cn(
                "relative flex flex-col items-center gap-1 transition-all duration-300",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
                <Icon className={cn("w-6 h-6", isActive && "drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]")} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
                {isActive && (
                  <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary shadow-[0_0_8px_rgba(124,58,237,0.8)]" />
                )}
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
