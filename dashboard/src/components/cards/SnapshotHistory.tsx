import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useHass } from "@hakit/core";
import type { Connection } from "home-assistant-js-websocket";
import { Icon } from "@iconify/react";
import {
  listSnapshots,
  resolveMediaUrl,
  type SnapshotEntry,
  type SnapshotSource,
} from "../../lib/snapshot-api";
import { toDateStr } from "../../lib/date-utils";

interface SnapshotHistoryProps {
  cameraId: string;
  /** Controlled date from parent */
  selectedDate: Date;
  /** Increment to trigger a re-fetch (e.g. after saving a new snapshot) */
  refreshKey?: number;
  /** Called when a snapshot is selected (URL) or deselected (null) */
  onSelect?: (url: string | null) => void;
}

const SOURCE_BADGE: Record<SnapshotSource, { icon: string; color: string } | null> = {
  person: { icon: "mdi:account", color: "bg-accent-red" },
  motion: { icon: "mdi:motion-sensor", color: "bg-accent-warm" },
  face: { icon: "mdi:face-recognition", color: "bg-accent-red/70" },
  scheduled: { icon: "mdi:clock-outline", color: "bg-accent-cool" },
  stream: { icon: "mdi:play", color: "bg-accent-green" },
  unknown: null,
};

function formatDate(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}


function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

interface DateNavigatorProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

export function DateNavigator({ selectedDate, onDateChange }: DateNavigatorProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const isToday = isSameDay(selectedDate, new Date());

  const goPrev = () => onDateChange(addDays(selectedDate, -1));
  const goNext = () => {
    const tomorrow = addDays(selectedDate, 1);
    if (tomorrow <= new Date()) onDateChange(tomorrow);
  };
  const goToday = () => onDateChange(new Date());

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      const [y, m, d] = val.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      if (date <= new Date()) onDateChange(date);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={goPrev}
        className="rounded-full p-1.5 text-text-secondary hover:bg-white/10 active:bg-white/15"
      >
        <Icon icon="mdi:chevron-left" width={18} />
      </button>

      <button
        onClick={() => dateInputRef.current?.showPicker()}
        className="flex flex-1 items-center justify-center gap-1.5 text-sm font-medium text-text-primary hover:text-accent active:text-accent"
      >
        <Icon icon="mdi:calendar" width={14} className="text-text-dim" />
        {formatDate(selectedDate)}
      </button>
      <input
        ref={dateInputRef}
        type="date"
        className="invisible absolute h-0 w-0"
        value={toDateStr(selectedDate)}
        max={toDateStr(new Date())}
        onChange={handleDateInput}
      />

      <button
        onClick={goNext}
        disabled={isToday}
        className="rounded-full p-1.5 text-text-secondary hover:bg-white/10 active:bg-white/15 disabled:opacity-30"
      >
        <Icon icon="mdi:chevron-right" width={18} />
      </button>

      {!isToday && (
        <button
          onClick={goToday}
          className="rounded-full px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10 active:bg-accent/10"
        >
          Today
        </button>
      )}
    </div>
  );
}

export function SnapshotHistory({ cameraId, selectedDate, refreshKey, onSelect }: SnapshotHistoryProps) {
  const connection = useHass((s) => s.connection) as Connection | null;
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSnap, setSelectedSnap] = useState<string | null>(null);
  const [resolvedUrls, setResolvedUrls] = useState<Map<string, string>>(new Map());
  const onSelectRef = useRef(onSelect);
  useLayoutEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  // Fetch snapshots when date or camera changes
  useEffect(() => {
    if (!connection) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setSelectedSnap(null);
      onSelectRef.current?.(null);

      const dateStr = toDateStr(selectedDate);
      const snaps = await listSnapshots(connection, cameraId, dateStr);
      if (cancelled) return;
      setSnapshots(snaps);
      setLoading(false);

      // Resolve URLs for all snapshots
      const urls = new Map<string, string>();
      await Promise.all(
        snaps.map(async (snap) => {
          const url = await resolveMediaUrl(connection, snap.mediaId);
          if (url) urls.set(snap.mediaId, url);
        }),
      );
      if (!cancelled) setResolvedUrls(urls);
    })();

    return () => { cancelled = true; };
  }, [connection, cameraId, selectedDate, refreshKey]);

  const handleSelect = (snap: SnapshotEntry) => {
    const url = resolvedUrls.get(snap.mediaId);
    if (!url) return;
    const next = selectedSnap === url ? null : url;
    setSelectedSnap(next);
    onSelect?.(next);
  };

  return (
    <div>
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Icon icon="mdi:loading" width={24} className="animate-spin text-text-dim" />
        </div>
      ) : snapshots.length === 0 ? (
        <p className="py-4 text-center text-xs text-text-dim">
          No snapshots for this date
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {snapshots.map((snap) => {
            const badge = SOURCE_BADGE[snap.source];
            const url = resolvedUrls.get(snap.mediaId);
            const isSelected = url != null && selectedSnap === url;

            return (
              <button
                key={snap.filename}
                onClick={() => handleSelect(snap)}
                className={`relative overflow-hidden rounded-lg transition-all ${
                  isSelected
                    ? "ring-2 ring-accent"
                    : "ring-1 ring-white/10 hover:ring-white/25"
                }`}
              >
                <div className="relative aspect-video">
                  {url ? (
                    <img
                      src={url}
                      alt={snap.filename}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-bg-elevated">
                      <Icon icon="mdi:image" width={16} className="text-text-dim" />
                    </div>
                  )}

                  {/* Source badge */}
                  {badge && (
                    <div
                      className={`absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full ${badge.color}`}
                    >
                      <Icon icon={badge.icon} width={10} className="text-white" />
                    </div>
                  )}

                  {/* Time label */}
                  <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-1 pb-0.5 pt-3">
                    <span className="text-[10px] tabular-nums text-white/90">
                      {snap.time.slice(0, 5)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
