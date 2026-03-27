// --- Period definitions ---
// Each period returns a stable ISO start time string (anchored to midnight/boundaries)

export type PeriodKey =
  | "today"
  | "yesterday"
  | "7d"
  | "28d"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom";

export interface PeriodDef {
  key: PeriodKey;
  label: string;
  start: () => Date;
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export const PERIODS: PeriodDef[] = [
  {
    key: "today",
    label: "Today",
    start: () => startOfToday(),
  },
  {
    key: "yesterday",
    label: "Yesterday",
    start: () => {
      const d = startOfToday();
      d.setDate(d.getDate() - 1);
      return d;
    },
  },
  {
    key: "7d",
    label: "Last 7 days",
    start: () => {
      const d = startOfToday();
      d.setDate(d.getDate() - 7);
      return d;
    },
  },
  {
    key: "28d",
    label: "Last 28 days",
    start: () => {
      const d = startOfToday();
      d.setDate(d.getDate() - 28);
      return d;
    },
  },
  {
    key: "this_week",
    label: "This week",
    start: () => {
      const d = startOfToday();
      const day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); // Monday
      return d;
    },
  },
  {
    key: "last_week",
    label: "Last week",
    start: () => {
      const d = startOfToday();
      const day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1) - 7);
      return d;
    },
  },
  {
    key: "this_month",
    label: "This month",
    start: () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  },
  {
    key: "last_month",
    label: "Last month",
    start: () => new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
  },
];
