import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { TransactionForm } from "./TransactionForm";
import { FAB } from "./FAB";
import { useToast } from "@/hooks/use-toast";

export function TransactionDrawer() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleSuccess = () => {
    setOpen(false);
    toast({ title: "Transaction saved" });
  };

  return (
    <>
      <FAB onClick={() => setOpen(true)} />
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="bg-background border-t border-white/10 text-foreground p-4 pb-safe max-h-[92dvh] overflow-y-auto">
          <DrawerHeader className="px-0 pb-2">
            <DrawerTitle>New Transaction</DrawerTitle>
          </DrawerHeader>
          <div className="pb-8">
            {open && <TransactionForm onSuccess={handleSuccess} />}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
