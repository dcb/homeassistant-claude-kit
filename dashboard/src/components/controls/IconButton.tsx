import { Icon } from "@iconify/react";
import type { Phase } from "../../lib/useControlCommit";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** MDI icon name. If omitted, renders children instead. */
  icon?: string;
  iconSize?: number;
  /** "ghost" (default) or "filled" background */
  variant?: "ghost" | "filled";
  /** "full" (default, rounded-full) or "lg" (rounded-lg) */
  shape?: "lg" | "full";
  phase?: Phase;
}

const base = "relative flex shrink-0 items-center justify-center min-w-[44px] min-h-[44px]";

const variants = {
  ghost: "text-text-dim hover:bg-white/10 active:bg-white/10",
  filled: "bg-white/10 text-text-primary hover:bg-white/15 active:bg-white/15",
};

const shapes = {
  lg: "rounded-lg",
  full: "rounded-full",
};

export function IconButton({
  icon,
  iconSize = 16,
  variant = "ghost",
  shape = "full",
  className = "",
  children,
  phase = "idle",
  onClick,
  ...rest
}: IconButtonProps) {
  const isNonIdle = phase !== "idle";

  const phaseClasses = phase === "debouncing" || phase === "inflight"
    ? "bg-accent-warm/15 text-accent-warm"
    : phase === "correction"
    ? "animate-shake"
    : "";

  const handleClick = isNonIdle
    ? (e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); }
    : onClick;

  return (
    <button
      className={`${base} ${shapes[shape]} ${variants[variant]} ${phaseClasses} ${className}`}
      onClick={handleClick}
      {...rest}
    >
      {icon ? <Icon icon={icon} width={iconSize} /> : children}
      {phase === "inflight" && (
        <div className={`absolute inset-0 ${shapes[shape]} border-2 border-transparent border-t-accent-warm animate-control-spin`} />
      )}
    </button>
  );
}
