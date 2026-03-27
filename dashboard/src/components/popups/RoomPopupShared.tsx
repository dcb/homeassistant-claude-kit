import { motion } from "framer-motion";

// --- Shared sub-components used across RoomPopup sections ---

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-text-dim">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function ToggleSwitch({ isOn, color }: { isOn: boolean; color: string }) {
  return (
    <div className={`h-5 w-9 rounded-full p-0.5 transition-colors ${isOn ? color : "bg-white/15"}`}>
      <motion.div
        className="h-4 w-4 rounded-full bg-white shadow"
        animate={{ x: isOn ? 16 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </div>
  );
}

