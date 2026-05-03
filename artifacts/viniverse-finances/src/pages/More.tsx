import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { clearAllData, db } from "@/hooks/use-finance";
import { Download, Upload, Trash2, Info, Moon, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRef } from "react";

export default function More() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClearData = async () => {
    await clearAllData();
    toast({
      title: "Data Cleared",
      description: "All your data has been successfully deleted.",
    });
    window.location.href = "/";
  };

  const handleExport = async () => {
    try {
      const accounts = await db.accounts.toArray();
      const transactions = await db.transactions.toArray();
      const data = { accounts, transactions };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `viniverse-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Export Successful",
        description: "Your data has been downloaded.",
      });
    } catch (e) {
      toast({
        title: "Export Failed",
        description: "An error occurred while exporting your data.",
        variant: "destructive",
      });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.accounts && data.transactions) {
        await clearAllData();
        await db.accounts.bulkAdd(data.accounts);
        await db.transactions.bulkAdd(data.transactions);
        localStorage.setItem('viniverse-seeded', 'true');
        toast({
          title: "Import Successful",
          description: "Your data has been restored.",
        });
        window.location.href = "/";
      } else {
        throw new Error("Invalid format");
      }
    } catch (e) {
      toast({
        title: "Import Failed",
        description: "The selected file is not a valid Viniverse backup.",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className="p-4 space-y-6 pt-12">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your app and data.</p>
        </header>

        <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/10 border border-white/10">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium">Viniverse Finances</h3>
                <p className="text-xs text-muted-foreground">Version 1.0.0</p>
              </div>
            </div>
          </div>
          
          <div className="p-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              This is a local-first application. All your data is stored securely in your browser. 
              We do not track you or send your financial data to any servers.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground px-1">Data Management</h3>
          
          <div className="glass-card rounded-2xl overflow-hidden divide-y divide-white/10 border border-white/10">
            <button 
              onClick={handleExport}
              className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
            >
              <Download className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-medium">Export Backup</h3>
                <p className="text-xs text-muted-foreground">Save your data to a JSON file</p>
              </div>
            </button>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
            >
              <Upload className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="font-medium">Import Backup</h3>
                <p className="text-xs text-muted-foreground">Restore data from a JSON file</p>
              </div>
            </button>
            <input 
              type="file" 
              accept=".json" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImport}
            />

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left text-rose-400">
                  <Trash2 className="w-5 h-5" />
                  <div>
                    <h3 className="font-medium">Clear All Data</h3>
                    <p className="text-xs text-rose-400/70">Permanently delete everything</p>
                  </div>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-background border-white/10">
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription className="text-muted-foreground">
                    This action cannot be undone. This will permanently delete all your accounts and transactions from your browser.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 text-foreground">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearData} className="bg-rose-500 text-white hover:bg-rose-600">
                    Yes, delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </Layout>
  );
}
