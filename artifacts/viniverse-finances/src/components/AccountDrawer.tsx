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
      <DrawerContent className="bg-background border-t border-white/10 text-foreground pb-safe p-4">
        <DrawerHeader className="px-0">
          <DrawerTitle>New Account</DrawerTitle>
        </DrawerHeader>
        <div className="pb-8">
          <AccountForm onSuccess={() => setOpen(false)} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
