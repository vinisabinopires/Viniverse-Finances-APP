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
        <DrawerContent className="bg-background border-t border-white/10 text-foreground flex flex-col max-h-[92dvh]">
          <DrawerHeader className="px-4 pt-2 pb-2 flex-shrink-0">
            <DrawerTitle>New Transaction</DrawerTitle>
          </DrawerHeader>
          <div
            className="flex-1 overflow-y-auto px-4"
            style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}
          >
            {open && (
              <TransactionForm
                onSuccess={handleSuccess}
                onCancel={() => setOpen(false)}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
