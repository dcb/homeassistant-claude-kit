import type { ReactNode } from "react";

export function CookModeFrame({ children, onExit, wakeActive, wakeSupported }: {
  children: ReactNode;
  onExit: () => void;
  wakeActive: boolean;
  wakeSupported: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-50">
      <div className="flex items-center gap-3 p-4 border-b border-white/10">
        <button onClick={onExit} className="text-white/60 hover:text-white">Exit Cook Mode</button>
        <span className="text-white/40 text-sm ml-auto">
          {wakeSupported ? (wakeActive ? "Screen on" : "Screen may sleep") : "Screen lock unsupported"}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
