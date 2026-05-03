import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Database } from "lucide-react";
import { seedDemoData } from "@/db/seed";

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [loading, setLoading] = useState(false);

  const handleStartEmpty = async () => {
    setLoading(true);
    localStorage.setItem('viniverse-onboarded', 'true');
    onComplete();
  };

  const handleLoadDemo = async () => {
    setLoading(true);
    await seedDemoData();
    localStorage.setItem('viniverse-onboarded', 'true');
    onComplete();
  };

  return (
    <AnimatePresence>
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="text-center space-y-3">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl shadow-purple-500/30 mx-auto"
            >
              <Sparkles className="w-9 h-9 text-white" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
                Viniverse
              </h1>
              <p className="text-muted-foreground mt-1 text-base">Your finances, under control.</p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card rounded-3xl p-6 space-y-4"
          >
            <p className="text-sm text-center text-muted-foreground">
              How would you like to get started?
            </p>

            <button
              onClick={handleLoadDemo}
              disabled={loading}
              data-testid="btn-load-demo"
              className="w-full text-left p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all active:scale-98 flex items-center gap-4 group"
            >
              <div className="w-11 h-11 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <Database className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">Load demo data</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Explore with sample accounts and transactions
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>

            <button
              onClick={handleStartEmpty}
              disabled={loading}
              data-testid="btn-start-empty"
              className="w-full text-left p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all active:scale-98 flex items-center gap-4 group"
            >
              <div className="w-11 h-11 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <ArrowRight className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">Start fresh</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Begin with a clean slate — no sample data
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-xs text-center text-muted-foreground px-4"
          >
            All data is stored locally in your browser. Nothing is sent to any server.
          </motion.p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
