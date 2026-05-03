import { useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AccountForm } from "./AccountForm";

export function AccountDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" className="w-full border-dashed border-white/20 bg-white/5 hover:bg-white/10 rounded-xl py-6">
          <Plus className="w-4 h-4 mr-2" /> Add Account
        </Button>
      </DrawerTrigger>
      <DrawerContent className="bg-background border-t border-white/10 text-foreground flex flex-col max-h-[92dvh]">
        <DrawerHeader className="px-4 pt-2 pb-2 flex-shrink-0">
          <DrawerTitle>New Account</DrawerTitle>
        </DrawerHeader>
        <div
          className="flex-1 overflow-y-auto px-4"
          style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}
        >
          <AccountForm
            onSuccess={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
