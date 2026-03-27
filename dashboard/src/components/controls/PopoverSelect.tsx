import { useState, cloneElement, isValidElement, type ReactNode, type ReactElement } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import type { Phase } from "../../lib/useControlCommit";

export interface PopoverSelectItem {
  value: string;
  label: ReactNode;
}

interface PopoverSelectProps {
  items: PopoverSelectItem[];
  value: string | undefined;
  onSelect: (value: string) => void;
  disabled?: boolean;
  /** Render prop for the trigger button — receives `asChild`-compatible ref forwarding from Radix */
  trigger: ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
  matchTriggerWidth?: boolean;
  /** Class for the popover content container */
  className?: string;
  /** Class for each item button — receives active state */
  itemClassName?: (active: boolean) => string;
  phase?: Phase;
}

const defaultItemClass = (active: boolean) =>
  `flex w-full items-center gap-3 px-4 py-3 min-h-[44px] text-left text-sm transition-colors hover:bg-white/10 active:bg-white/10 ${
    active ? "bg-white/10 font-medium" : ""
  }`;

const isTouchDevice = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches;

function phaseTriggerClasses(phase: Phase): string {
  if (phase === "debouncing") return "text-accent-warm ring-1 ring-accent-warm";
  if (phase === "inflight") return "text-accent-warm ring-1 ring-accent-warm animate-text-glow";
  if (phase === "correction") return "animate-shake";
  return "";
}

/** Add phase classes directly to the trigger element, preserving its layout */
function styleTrigger(trigger: ReactNode, phase: Phase): ReactNode {
  if (phase === "idle" || !isValidElement(trigger)) return trigger;
  const el = trigger as ReactElement<{ className?: string }>;
  const extra = phaseTriggerClasses(phase);
  return cloneElement(el, {
    className: `${el.props.className ?? ""} ${extra}`.trim(),
  });
}

export function PopoverSelect({
  items,
  value,
  onSelect,
  disabled,
  trigger,
  side = "bottom",
  align = "start",
  matchTriggerWidth = true,
  className = "z-60 min-w-48 max-h-60 overflow-y-auto rounded-xl bg-bg-card shadow-lg ring-1 ring-white/10",
  itemClassName = defaultItemClass,
  phase = "idle",
}: PopoverSelectProps) {
  if (isTouchDevice) {
    return (
      <ActionSheet
        items={items}
        value={value}
        onSelect={onSelect}
        disabled={disabled}
        trigger={trigger}
        phase={phase}
      />
    );
  }

  const isInflight = phase === "inflight";

  return (
    <Popover.Root modal>
      <Popover.Trigger asChild disabled={disabled || isInflight}>
        {styleTrigger(trigger, phase)}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          sideOffset={4}
          align={align}
          style={matchTriggerWidth ? { minWidth: "var(--radix-popover-trigger-width)" } : undefined}
          className={className}
        >
          {items.map((item) => (
            <Popover.Close asChild key={item.value}>
              <button
                onClick={() => onSelect(item.value)}
                className={itemClassName(item.value === value)}
              >
                {item.label}
              </button>
            </Popover.Close>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// --- Action sheet for touch devices ---

const actionSheetItemClass = (active: boolean) =>
  `flex w-full items-center gap-3 px-5 py-3.5 min-h-[52px] text-left text-base transition-colors active:bg-white/10 ${
    active ? "bg-white/10 font-medium" : ""
  }`;

function ActionSheet({
  items,
  value,
  onSelect,
  disabled,
  trigger,
  phase = "idle",
}: {
  items: PopoverSelectItem[];
  value: string | undefined;
  onSelect: (value: string) => void;
  disabled?: boolean;
  trigger: ReactNode;
  phase?: Phase;
}) {
  const [open, setOpen] = useState(false);
  const dragControls = useDragControls();

  const handleOpenChange = (next: boolean) => {
    if (next && phase === "inflight") return;
    setOpen(next);
  };

  const handleSelect = (v: string) => {
    onSelect(v);
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild disabled={disabled || phase === "inflight"}>
        {styleTrigger(trigger, phase)}
      </Dialog.Trigger>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50"
                onClick={() => setOpen(false)}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                drag="y"
                dragControls={dragControls}
                dragListener={false}
                dragConstraints={{ top: 0 }}
                dragElastic={{ top: 0, bottom: 0.5 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 80 || info.velocity.y > 400) {
                    setOpen(false);
                  }
                }}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 350 }}
                className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[60vh] flex-col rounded-t-2xl bg-bg-card pb-[env(safe-area-inset-bottom)]"
              >
                {/* Drag handle — only this area initiates swipe-to-dismiss */}
                <div
                  className="flex shrink-0 cursor-grab justify-center pt-3 pb-1 active:cursor-grabbing"
                  onPointerDown={(e) => dragControls.start(e)}
                  style={{ touchAction: "none" }}
                >
                  <div className="h-1 w-10 rounded-full bg-white/20" />
                </div>
                <Dialog.Title className="sr-only">Select option</Dialog.Title>
                <Dialog.Description className="sr-only">Choose from the list below</Dialog.Description>
                {/* Scrollable items */}
                <div className="overflow-y-auto pb-2">
                  {items.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => handleSelect(item.value)}
                      className={actionSheetItemClass(item.value === value)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
