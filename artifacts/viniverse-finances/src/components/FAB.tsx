import { Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FABProps {
  onClick: () => void;
}

export function FAB({ onClick }: FABProps) {
  return (
    <AnimatePresence>
      <motion.button
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className="fixed bottom-24 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-purple-500/30 flex items-center justify-center border border-white/20 backdrop-blur-md"
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </motion.button>
    </AnimatePresence>
  );
}
