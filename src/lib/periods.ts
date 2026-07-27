export type PeriodKey = "1D" | "5D" | "1M" | "6M" | "1Y" | "5Y";

export interface PeriodSpec {
  /** How far back to request (ms). */
  lookbackMs: number;
  interval: "5m" | "30m" | "1d" | "1wk";
  /** Keep only the most recent trading day of bars. */
  lastDayOnly?: boolean;
}

const DAY = 86_400_000;

export const PERIODS: Record<PeriodKey, PeriodSpec> = {
  "1D": { lookbackMs: 5 * DAY, interval: "5m", lastDayOnly: true },
  "5D": { lookbackMs: 9 * DAY, interval: "30m" },
  "1M": { lookbackMs: 32 * DAY, interval: "1d" },
  "6M": { lookbackMs: 183 * DAY, interval: "1d" },
  "1Y": { lookbackMs: 366 * DAY, interval: "1d" },
  "5Y": { lookbackMs: 5 * 366 * DAY, interval: "1wk" },
};

export const PERIOD_KEYS = Object.keys(PERIODS) as PeriodKey[];
