/** Statistics helpers shared by the analyst/forecaster/connector scripts. */

export function dailyReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) out.push(Math.log(closes[i] / closes[i - 1]));
  return out;
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

export function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return NaN;
  const xa = a.slice(-n);
  const xb = b.slice(-n);
  const ma = mean(xa);
  const mb = mean(xb);
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    cov += (xa[i] - ma) * (xb[i] - mb);
    va += (xa[i] - ma) ** 2;
    vb += (xb[i] - mb) ** 2;
  }
  return va && vb ? cov / Math.sqrt(va * vb) : NaN;
}

/** Slope of OLS regression of asset returns on benchmark returns. */
export function beta(asset: number[], bench: number[]): number {
  const n = Math.min(asset.length, bench.length);
  if (n < 3) return NaN;
  const xa = asset.slice(-n);
  const xb = bench.slice(-n);
  const mb = mean(xb);
  const ma = mean(xa);
  let cov = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    cov += (xa[i] - ma) * (xb[i] - mb);
    vb += (xb[i] - mb) ** 2;
  }
  return vb ? cov / vb : NaN;
}

export function sma(closes: number[], window: number): number | null {
  if (closes.length < window) return null;
  return mean(closes.slice(-window));
}

export function rsi(closes: number[], window = 14): number | null {
  if (closes.length < window + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - window; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

export function maxDrawdown(closes: number[]): number {
  let peak = -Infinity;
  let mdd = 0;
  for (const c of closes) {
    peak = Math.max(peak, c);
    mdd = Math.min(mdd, c / peak - 1);
  }
  return mdd;
}

export interface McResult {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  probAboveSpot: number;
}

/** Monte Carlo GBM on daily log returns. */
export function monteCarloGBM(
  spot: number,
  muDaily: number,
  sigmaDaily: number,
  days: number,
  paths = 5000,
): McResult {
  const terminal: number[] = new Array(paths);
  let above = 0;
  for (let p = 0; p < paths; p++) {
    let logP = Math.log(spot);
    for (let d = 0; d < days; d++) {
      // Box-Muller
      const u1 = Math.random() || 1e-12;
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      logP += muDaily - 0.5 * sigmaDaily ** 2 + sigmaDaily * z;
    }
    const price = Math.exp(logP);
    terminal[p] = price;
    if (price > spot) above++;
  }
  terminal.sort((a, b) => a - b);
  const q = (frac: number) => terminal[Math.min(paths - 1, Math.floor(frac * paths))];
  return { p5: q(0.05), p25: q(0.25), p50: q(0.5), p75: q(0.75), p95: q(0.95), probAboveSpot: above / paths };
}

export const TRADING_DAYS = 252;
