export function fmtNum(n: number | null | undefined, dp = 2): string {
  if (n == null || !isFinite(n)) return "–";
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

/** Price formatting that adapts decimals to magnitude (FX vs indices). */
export function fmtPrice(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "–";
  const dp = Math.abs(n) >= 1000 ? 2 : Math.abs(n) >= 1 ? 2 : 4;
  return fmtNum(n, dp);
}

export function fmtPct(n: number | null | undefined, sign = true): string {
  if (n == null || !isFinite(n)) return "–";
  const s = sign && n > 0 ? "+" : "";
  return `${s}${n.toFixed(2)}%`;
}

export function fmtChange(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "–";
  const s = n > 0 ? "+" : "";
  return `${s}${fmtPrice(n)}`;
}

/** 1234567890 -> 1.23B */
export function fmtBig(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "–";
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(Math.round(n));
}

const SPARK = "▁▂▃▄▅▆▇█";

export function sparkline(values: number[], width = 12): string {
  if (values.length === 0) return " ".repeat(width);
  const pts = resample(values, width);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  return pts.map((v) => SPARK[Math.round(((v - min) / span) * (SPARK.length - 1))]).join("");
}

/** Evenly resample a series to n points, always keeping the last point. */
export function resample(values: number[], n: number): number[] {
  if (values.length <= n) return values;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(values[Math.round((i * (values.length - 1)) / (n - 1))]);
  }
  return out;
}

/** Position marker within a range: ───────●──── */
export function rangeBar(low: number, high: number, value: number, width = 14): string {
  if (!isFinite(low) || !isFinite(high) || high <= low) return "─".repeat(width);
  const pos = Math.min(width - 1, Math.max(0, Math.round(((value - low) / (high - low)) * (width - 1))));
  return "─".repeat(pos) + "●" + "─".repeat(width - 1 - pos);
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, Math.max(0, max - 1)) + "…";
}

export function timeHHMMSS(d = new Date()): string {
  return d.toTimeString().slice(0, 8);
}
