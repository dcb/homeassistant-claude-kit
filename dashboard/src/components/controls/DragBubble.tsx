// DragBubble.tsx
import { AnimatePresence, motion } from "framer-motion";

interface DragBubbleProps {
  visible: boolean;
  value: string;
  /** 0–1 ratio positioning along the track */
  ratio: number;
}

export function DragBubble({ visible, value, ratio }: DragBubbleProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.1 }}
          className="pointer-events-none absolute -top-9 tabular-nums text-xs font-medium text-text-primary bg-bg-elevated rounded-md px-2 py-1 shadow-md border border-white/10"
          style={{ left: `calc(${ratio} * (100% - 20px) + 10px)`, transform: "translateX(-50%)" }}
        >
          {value}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
