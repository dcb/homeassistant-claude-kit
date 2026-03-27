// Re-export mergeTimeSeries from the shared utility (no duplication)
export { mergeTimeSeries } from "../../lib/history-utils";

export function formatTime(ts: number, showDate: boolean): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  if (!showDate) return time;
  const date = d.toLocaleDateString([], { day: "numeric", month: "short" });
  return `${date} ${time}`;
}
