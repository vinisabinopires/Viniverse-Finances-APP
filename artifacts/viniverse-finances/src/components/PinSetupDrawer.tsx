import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Delete, CheckCircle2, AlertTriangle, ChevronLeft } from "lucide-react";
import {
  hashPin, generateSalt, enablePin, disablePin, verifyPin,
} from "@/lib/pin-security";

// ── Types ──────────────────────────────────────────────────────────────────────

export type PinSetupMode = "setup" | "change" | "disable";

interface PinSetupDrawerProps {
  open: boolean;
  mode: PinSetupMode;
  onClose: () => void;
  onSuccess: () => void;
}

type Step =
  | "verify_current"
  | "new_pin"
  | "confirm_pin"
  | "success";

// ── Mini numpad ────────────────────────────────────────────────────────────────

const ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "⌫"],
] as const;

interface PinStepProps {
  label: string;
  sublabel?: string;
  error?: string;
  onComplete: (pin: string) => void;
  disabled?: boolean;
}

function PinStep({ label, sublabel, error, onComplete, disabled }: PinStepProps) {
  const [pin, setPin] = useState("");
  const [shakeKey, setShakeKey] = useState(0);

  // reset on every mount
  useEffect(() => { setPin(""); }, []);

  // shake on new error
  useEffect(() => {
    if (error) { setShakeKey((k) => k + 1); setPin(""); }
  }, [error]);

  const onDigit = useCallback(
    (d: string) => {
      if (disabled) return;
      if (d === "⌫") { setPin((p) => p.slice(0, -1)); return; }
      if (d === "") return;
      const next = pin.length < 4 ? pin + d : pin;
      setPin(next);
      if (next.length === 4) {
        onComplete(next);
        // Do NOT reset pin here — parent may show error and reset via effect
      }
    },
    [pin, disabled, onComplete]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) onDigit(e.key);
      if (e.key === "Backspace") onDigit("⌫");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDigit]);

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Label */}
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>

      {/* Dots */}
      <motion.div
        key={shakeKey}
        animate={shakeKey > 0 ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-4"
      >
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            animate={{
              scale: pin.length > i ? 1.15 : 1,
              backgroundColor: pin.length > i ? "rgb(124,58,237)" : "rgba(255,255,255,0.1)",
            }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="w-4 h-4 rounded-full border border-white/20"
          />
        ))}
      </motion.div>

      {/* Error */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            key={error}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-rose-400 text-xs"
          >
            <AlertTriangle className="w-3 h-3" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Numpad */}
      <div className="w-full space-y-2">
        {ROWS.map((row, ri) => (
          <div key={ri} className="grid grid-cols-3 gap-2">
            {row.map((digit, ci) => (
              <button
                key={ci}
                onClick={() => onDigit(digit)}
                disabled={disabled || digit === ""}
                aria-label={digit === "⌫" ? "Backspace" : digit === "" ? "" : digit}
                className={`
                  h-14 rounded-2xl flex items-center justify-center text-xl font-semibold
                  transition-all active:scale-95 touch-manipulation
                  ${digit === "" ? "pointer-events-none" : ""}
                  ${digit === "⌫"
                    ? "bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10"
                    : digit !== ""
                    ? "bg-white/8 border border-white/10 text-foreground hover:bg-white/15 active:bg-white/20"
                    : ""
                  }
                  disabled:opacity-40
                `}
              >
                {digit === "⌫" ? <Delete className="w-4 h-4" /> : digit}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main drawer ────────────────────────────────────────────────────────────────

export function PinSetupDrawer({ open, mode, onClose, onSuccess }: PinSetupDrawerProps) {
  const [step, setStep] = useState<Step>(mode === "setup" ? "new_pin" : "verify_current");
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Reset state when drawer opens
  useEffect(() => {
    if (open) {
      setStep(mode === "setup" ? "new_pin" : "verify_current");
      setNewPin("");
      setError("");
      setBusy(false);
    }
  }, [open, mode]);

  const stepLabel: Record<Step, string> = {
    verify_current: "Enter your current PIN",
    new_pin: mode === "setup" ? "Create a 4-digit PIN" : "Enter your new PIN",
    confirm_pin: "Confirm your PIN",
    success: "Done",
  };

  const stepSublabel: Partial<Record<Step, string>> = {
    new_pin: mode === "setup" ? "Choose a PIN you'll remember" : undefined,
    confirm_pin: "Enter the same PIN again",
    verify_current: mode === "change" ? "Verify your current PIN before changing it" : "Verify your PIN to disable lock",
  };

  // ── Step handlers ────────────────────────────────────────────────────────

  const handleVerifyCurrent = async (pin: string) => {
    setBusy(true);
    const ok = await verifyPin(pin);
    setBusy(false);
    if (!ok) {
      setError("Incorrect PIN. Try again.");
      return;
    }
    setError("");
    if (mode === "disable") {
      disablePin();
      setStep("success");
      setTimeout(() => { onSuccess(); onClose(); }, 1200);
    } else {
      setStep("new_pin");
    }
  };

  const handleNewPin = (pin: string) => {
    if (pin.length < 4) return;
    setNewPin(pin);
    setError("");
    setStep("confirm_pin");
  };

  const handleConfirmPin = async (pin: string) => {
    if (pin !== newPin) {
      setError("PINs don't match. Try again.");
      setStep("new_pin");
      setNewPin("");
      return;
    }
    setBusy(true);
    const salt = generateSalt();
    const hash = await hashPin(pin, salt);
    enablePin(hash, salt);
    setBusy(false);
    setStep("success");
    setTimeout(() => { onSuccess(); onClose(); }, 1200);
  };

  const handleBack = () => {
    setError("");
    if (step === "confirm_pin") { setStep("new_pin"); setNewPin(""); }
    else onClose();
  };

  // ── Titles ────────────────────────────────────────────────────────────────

  const drawerTitle =
    mode === "setup" ? "Set Up PIN Lock" :
    mode === "change" ? "Change PIN" :
    "Disable PIN Lock";

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DrawerContent className="bg-background border-t border-white/10 text-foreground px-4 pb-safe max-h-[90dvh]">
        <DrawerHeader className="px-0 pt-4 pb-2">
          <div className="flex items-center gap-2">
            {step !== "success" && (
              <button
                onClick={handleBack}
                className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Back"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <DrawerTitle className="text-base">{drawerTitle}</DrawerTitle>
          </div>
        </DrawerHeader>

        <div className="pb-8">
          <AnimatePresence mode="wait">
            {step === "success" ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 py-10"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-sm font-semibold text-emerald-400">
                  {mode === "disable" ? "PIN lock disabled" : mode === "change" ? "PIN changed" : "PIN lock enabled"}
                </p>
              </motion.div>
            ) : step === "verify_current" ? (
              <motion.div key="verify" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <PinStep
                  label={stepLabel.verify_current}
                  sublabel={stepSublabel.verify_current}
                  error={error}
                  onComplete={handleVerifyCurrent}
                  disabled={busy}
                />
              </motion.div>
            ) : step === "new_pin" ? (
              <motion.div key="new" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <PinStep
                  label={stepLabel.new_pin}
                  sublabel={stepSublabel.new_pin}
                  error={error}
                  onComplete={handleNewPin}
                  disabled={busy}
                />
              </motion.div>
            ) : (
              <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <PinStep
                  label={stepLabel.confirm_pin}
                  sublabel={stepSublabel.confirm_pin}
                  error={error}
                  onComplete={handleConfirmPin}
                  disabled={busy}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
