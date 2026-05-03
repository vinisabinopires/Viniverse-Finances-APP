import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, ShieldCheck, AlertTriangle } from "lucide-react";
import { verifyPin, setLastUnlocked, clearPinForReset } from "@/lib/pin-security";

interface LockScreenProps {
  onUnlock: () => void;
}

const NUMPAD_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "⌫"],
] as const;

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotConfirm, setForgotConfirm] = useState(false);
  const attemptsRef = useRef(0);

  const handleUnlock = useCallback(
    async (currentPin: string) => {
      if (currentPin.length !== 4 || checking) return;
      setChecking(true);
      const ok = await verifyPin(currentPin);
      if (ok) {
        setLastUnlocked();
        attemptsRef.current = 0;
        onUnlock();
      } else {
        attemptsRef.current += 1;
        setPin("");
        setError(
          attemptsRef.current >= 3
            ? "Incorrect PIN. Tap 'Forgot PIN?' if you need help."
            : "Incorrect PIN. Try again."
        );
        setShakeKey((k) => k + 1);
      }
      setChecking(false);
    },
    [checking, onUnlock]
  );

  const onDigit = useCallback(
    (d: string) => {
      if (checking) return;
      if (d === "⌫") {
        setError("");
        setPin((prev) => prev.slice(0, -1));
        return;
      }
      if (d === "") return;
      setError("");
      const next = pin.length < 4 ? pin + d : pin;
      setPin(next);
      if (next.length === 4) handleUnlock(next);
    },
    [pin, checking, handleUnlock]
  );

  const handleForgotPinReset = () => {
    clearPinForReset();
    onUnlock();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) onDigit(e.key);
      if (e.key === "Backspace") onDigit("⌫");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDigit]);

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-between py-16 px-6 select-none">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/8 rounded-full blur-3xl" />
      </div>

      {/* Top: branding */}
      <div className="flex flex-col items-center gap-3 relative z-10">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
          <ShieldCheck className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Viniverse</h1>
        <p className="text-sm text-muted-foreground">Enter your PIN to continue</p>
      </div>

      {/* Middle: dots + error */}
      <div className="flex flex-col items-center gap-4 relative z-10">
        <motion.div
          key={shakeKey}
          animate={shakeKey > 0 ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-5"
        >
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              animate={{
                scale: pin.length > i ? 1.1 : 1,
                backgroundColor: pin.length > i ? "rgb(124,58,237)" : "rgba(255,255,255,0.1)",
              }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="w-4 h-4 rounded-full border border-white/20"
            />
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key={error}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-rose-400 text-sm"
            >
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Numpad */}
      <div className="w-full max-w-xs relative z-10 space-y-2">
        {NUMPAD_ROWS.map((row, ri) => (
          <div key={ri} className="grid grid-cols-3 gap-2">
            {row.map((digit, ci) => (
              <button
                key={ci}
                onClick={() => onDigit(digit)}
                disabled={checking || digit === ""}
                aria-label={digit === "⌫" ? "Backspace" : digit === "" ? "" : digit}
                className={`
                  h-16 rounded-2xl flex items-center justify-center text-xl font-semibold
                  transition-all active:scale-95 touch-manipulation
                  ${digit === "" ? "pointer-events-none" : ""}
                  ${digit === "⌫"
                    ? "bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10 active:bg-white/15"
                    : digit !== ""
                    ? "bg-white/8 border border-white/10 text-foreground hover:bg-white/15 active:bg-white/20"
                    : ""
                  }
                  disabled:opacity-40
                `}
              >
                {digit === "⌫" ? <Delete className="w-5 h-5" /> : digit}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Forgot PIN */}
      <div className="relative z-10">
        {!showForgot ? (
          <button
            onClick={() => setShowForgot(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Forgot PIN?
          </button>
        ) : !forgotConfirm ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-3 max-w-xs"
          >
            <p className="text-xs text-muted-foreground leading-relaxed">
              Removing PIN lock will grant immediate access. Your financial data is <em>not</em> deleted.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowForgot(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-muted-foreground hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setForgotConfirm(true)}
                className="flex-1 py-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-sm text-rose-400 hover:bg-rose-500/30 transition-colors"
              >
                Remove PIN Lock
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-3 max-w-xs"
          >
            <p className="text-xs text-rose-400 font-medium">Are you sure? This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowForgot(false); setForgotConfirm(false); }}
                className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-muted-foreground hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleForgotPinReset}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 text-sm text-white font-semibold hover:bg-rose-600 transition-colors"
              >
                Confirm Reset
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
