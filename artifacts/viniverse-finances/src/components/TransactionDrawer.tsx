import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { TransactionForm } from "./TransactionForm";
import { FAB } from "./FAB";

export function TransactionDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <FAB onClick={() => setOpen(true)} />
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="bg-background border-t border-white/10 text-foreground pb-safe p-4">
          <DrawerHeader className="px-0">
            <DrawerTitle>New Transaction</DrawerTitle>
          </DrawerHeader>
          <div className="pb-8">
            <TransactionForm onSuccess={() => setOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
