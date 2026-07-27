/**
 * Chart strategies: indicator overlays + trade signals computed from candles.
 * Rendered on the main chart; any number can be active at once.
 *
 * Two kinds:
 *  - overlay strategies draw price-scaled lines (SMA, Bollinger, Supertrend…)
 *  - signal-only strategies (RSI, MACD, Stochastic…) live on their own scale,
 *    so they draw nothing but still print ▲/▼ signals under the chart.
 */
import asciichart from "asciichart";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Candle } from "./yahoo.js";

export interface Overlay {
  name: string;
  /** Ink color for the legend. */
  ink: string;
  /** asciichart ANSI color for the plotted line. */
  ansi: string;
  /** Full-length series aligned to candles; NaN during warm-up. */
  values: number[];
  /** Draw as scattered dots (e.g. PSAR) instead of a connected line. */
  style?: "dots";
}

export interface Signal {
  index: number;
  side: "buy" | "sell";
  label: string;
}

export interface StrategyResult {
  overlays: Overlay[];
  signals: Signal[];
  /** Set when there isn't enough history for the indicator. */
  note?: string;
}

export interface Strategy {
  key: string;
  label: string;
  desc: string;
  compute: (candles: Candle[]) => StrategyResult;
}

/* ── series helpers ─────────────────────────────────────────────── */

function nans(n: number): number[] {
  return new Array<number>(n).fill(NaN);
}

function smaSeries(values: number[], window: number): number[] {
  const out = nans(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    if (i >= window - 1) out[i] = sum / window;
  }
  return out;
}

function emaSeries(values: number[], window: number): number[] {
  const out = nans(values.length);
  if (values.length < window) return out;
  const k = 2 / (window + 1);
  let ema = values.slice(0, window).reduce((a, b) => a + b, 0) / window;
  out[window - 1] = ema;
  for (let i = window; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

/** EMA that starts from the first defined value of a series with NaN warm-up. */
function emaOf(values: number[], window: number): number[] {
  const out = nans(values.length);
  const start = values.findIndex((v) => !isNaN(v));
  if (start < 0 || values.length - start < window) return out;
  const k = 2 / (window + 1);
  let ema = 0;
  for (let i = 0; i < window; i++) ema += values[start + i];
  ema /= window;
  out[start + window - 1] = ema;
  for (let i = start + window; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

function rollingStd(values: number[], window: number): number[] {
  const out = nans(values.length);
  for (let i = window - 1; i < values.length; i++) {
    const slice = values.slice(i - window + 1, i + 1);
    const m = slice.reduce((a, b) => a + b, 0) / window;
    out[i] = Math.sqrt(slice.reduce((a, b) => a + (b - m) ** 2, 0) / window);
  }
  return out;
}

function highest(values: number[], window: number): number[] {
  const out = nans(values.length);
  for (let i = window - 1; i < values.length; i++) out[i] = Math.max(...values.slice(i - window + 1, i + 1));
  return out;
}

function lowest(values: number[], window: number): number[] {
  const out = nans(values.length);
  for (let i = window - 1; i < values.length; i++) out[i] = Math.min(...values.slice(i - window + 1, i + 1));
  return out;
}

function trueRange(c: Candle[]): number[] {
  return c.map((bar, i) =>
    i === 0 ? bar.high - bar.low : Math.max(bar.high - bar.low, Math.abs(bar.high - c[i - 1].close), Math.abs(bar.low - c[i - 1].close)),
  );
}

/** Wilder-smoothed series (used by ATR, ADX, RSI). */
function wilderSmooth(values: number[], window: number): number[] {
  const out = nans(values.length);
  if (values.length < window) return out;
  let acc = values.slice(0, window).reduce((a, b) => a + b, 0) / window;
  out[window - 1] = acc;
  for (let i = window; i < values.length; i++) {
    acc = (acc * (window - 1) + values[i]) / window;
    out[i] = acc;
  }
  return out;
}

function atrSeries(c: Candle[], window: number): number[] {
  return wilderSmooth(trueRange(c), window);
}

function typicalPrice(c: Candle[]): number[] {
  return c.map((b) => (b.high + b.low + b.close) / 3);
}

/** a crossing above b = buy, below = sell. */
function crossSignals(a: number[], b: number[], buyLabel: string, sellLabel: string): Signal[] {
  const signals: Signal[] = [];
  for (let i = 1; i < a.length; i++) {
    if ([a[i], a[i - 1], b[i], b[i - 1]].some(isNaN)) continue;
    if (a[i - 1] <= b[i - 1] && a[i] > b[i]) signals.push({ index: i, side: "buy", label: buyLabel });
    if (a[i - 1] >= b[i - 1] && a[i] < b[i]) signals.push({ index: i, side: "sell", label: sellLabel });
  }
  return signals;
}

const shortNote = (need: number, have: number) => (have < need ? `needs ${need} bars (have ${have})` : undefined);

/* ── strategies ─────────────────────────────────────────────────── */

export const STRATEGIES: Strategy[] = [
  {
    key: "SMA",
    label: "SMA 50/200 cross",
    desc: "long-term trend — golden / death cross",
    compute(candles) {
      const closes = candles.map((c) => c.close);
      const fast = smaSeries(closes, 50);
      const slow = smaSeries(closes, 200);
      return {
        overlays: [
          { name: "SMA50", ink: "yellow", ansi: asciichart.yellow, values: fast },
          { name: "SMA200", ink: "magenta", ansi: asciichart.magenta, values: slow },
        ],
        signals: crossSignals(fast, slow, "golden cross", "death cross"),
        note: closes.length < 200 ? `SMA200 needs 200 bars (have ${closes.length}) — try 1Y/5Y` : undefined,
      };
    },
  },
  {
    key: "EMA",
    label: "EMA 12/26 cross",
    desc: "momentum crossover (MACD line basis)",
    compute(candles) {
      const closes = candles.map((c) => c.close);
      const fast = emaSeries(closes, 12);
      const slow = emaSeries(closes, 26);
      return {
        overlays: [
          { name: "EMA12", ink: "cyan", ansi: asciichart.cyan, values: fast },
          { name: "EMA26", ink: "blue", ansi: asciichart.blue, values: slow },
        ],
        signals: crossSignals(fast, slow, "EMA bull cross", "EMA bear cross"),
        note: shortNote(26, closes.length),
      };
    },
  },
  {
    key: "BB",
    label: "Bollinger 20 ± 2σ",
    desc: "volatility bands — mean reversion",
    compute(candles) {
      const closes = candles.map((c) => c.close);
      const mid = smaSeries(closes, 20);
      const sd = rollingStd(closes, 20);
      const upper = mid.map((m, i) => m + 2 * sd[i]);
      const lower = mid.map((m, i) => m - 2 * sd[i]);
      return {
        overlays: [
          { name: "BB↑", ink: "gray", ansi: asciichart.darkgray, values: upper },
          { name: "BB mid", ink: "white", ansi: asciichart.lightgray, values: mid },
          { name: "BB↓", ink: "gray", ansi: asciichart.darkgray, values: lower },
        ],
        signals: [
          ...crossSignals(lower, closes, "below lower band", "back inside ↓band").filter((s) => s.side === "buy"),
          ...crossSignals(closes, upper, "above upper band", "back inside ↑band").filter((s) => s.side === "buy").map(
            (s) => ({ ...s, side: "sell" as const, label: "above upper band" }),
          ),
        ],
        note: shortNote(20, closes.length),
      };
    },
  },
  {
    key: "DON",
    label: "Donchian 20",
    desc: "breakout channel (20-bar high/low)",
    compute(candles) {
      const n = candles.length;
      const upper = nans(n);
      const lower = nans(n);
      for (let i = 20; i < n; i++) {
        const win = candles.slice(i - 20, i); // prior 20 bars, excluding current
        upper[i] = Math.max(...win.map((c) => c.high));
        lower[i] = Math.min(...win.map((c) => c.low));
      }
      const closes = candles.map((c) => c.close);
      return {
        overlays: [
          { name: "DON↑", ink: "greenBright", ansi: asciichart.lightgreen, values: upper },
          { name: "DON↓", ink: "redBright", ansi: asciichart.lightred, values: lower },
        ],
        signals: [
          ...crossSignals(closes, upper, "Donchian breakout ↑", "x").filter((s) => s.side === "buy"),
          ...crossSignals(closes, lower, "x", "Donchian breakdown ↓").filter((s) => s.side === "sell"),
        ],
        note: shortNote(21, n),
      };
    },
  },
  {
    key: "VWAP",
    label: "VWAP",
    desc: "volume-weighted avg price (session on 1D, rolling 20 else)",
    compute(candles) {
      const n = candles.length;
      const tp = typicalPrice(candles);
      const vwap = nans(n);
      const intraday = n > 1 && candles[0].date.toDateString() === candles[n - 1].date.toDateString();
      if (candles.every((c) => !c.volume)) {
        return { overlays: [], signals: [], note: "no volume data for this symbol" };
      }
      if (intraday) {
        let pv = 0;
        let vol = 0;
        for (let i = 0; i < n; i++) {
          pv += tp[i] * candles[i].volume;
          vol += candles[i].volume;
          vwap[i] = vol ? pv / vol : NaN;
        }
      } else {
        for (let i = 19; i < n; i++) {
          let pv = 0;
          let vol = 0;
          for (let j = i - 19; j <= i; j++) {
            pv += tp[j] * candles[j].volume;
            vol += candles[j].volume;
          }
          vwap[i] = vol ? pv / vol : NaN;
        }
      }
      const closes = candles.map((c) => c.close);
      return {
        overlays: [{ name: intraday ? "VWAP" : "VWAP20", ink: "magentaBright", ansi: asciichart.lightmagenta, values: vwap }],
        signals: crossSignals(closes, vwap, "VWAP reclaim ↑", "VWAP loss ↓"),
        note: intraday ? undefined : shortNote(20, n),
      };
    },
  },
  {
    key: "KELT",
    label: "Keltner 20 ± 2·ATR",
    desc: "ATR channel — trend breakout",
    compute(candles) {
      const closes = candles.map((c) => c.close);
      const mid = emaSeries(closes, 20);
      const atr = atrSeries(candles, 10);
      const upper = mid.map((m, i) => m + 2 * atr[i]);
      const lower = mid.map((m, i) => m - 2 * atr[i]);
      return {
        overlays: [
          { name: "KC↑", ink: "blueBright", ansi: asciichart.lightblue, values: upper },
          { name: "KC mid", ink: "blue", ansi: asciichart.blue, values: mid },
          { name: "KC↓", ink: "blueBright", ansi: asciichart.lightblue, values: lower },
        ],
        signals: [
          ...crossSignals(closes, upper, "Keltner break ↑", "x").filter((s) => s.side === "buy"),
          ...crossSignals(closes, lower, "x", "Keltner break ↓").filter((s) => s.side === "sell"),
        ],
        note: shortNote(20, closes.length),
      };
    },
  },
  {
    key: "ICH",
    label: "Ichimoku Tenkan/Kijun",
    desc: "conversion/base line cross (cloud omitted)",
    compute(candles) {
      const highs = candles.map((c) => c.high);
      const lows = candles.map((c) => c.low);
      const mid = (hh: number[], ll: number[]) => hh.map((h, i) => (h + ll[i]) / 2);
      const tenkan = mid(highest(highs, 9), lowest(lows, 9));
      const kijun = mid(highest(highs, 26), lowest(lows, 26));
      return {
        overlays: [
          { name: "Tenkan9", ink: "cyanBright", ansi: asciichart.lightcyan, values: tenkan },
          { name: "Kijun26", ink: "white", ansi: asciichart.lightgray, values: kijun },
        ],
        signals: crossSignals(tenkan, kijun, "TK cross ↑", "TK cross ↓"),
        note: shortNote(26, candles.length),
      };
    },
  },
  {
    key: "PSAR",
    label: "Parabolic SAR",
    desc: "trailing stop-and-reverse dots (0.02/0.2)",
    compute(candles) {
      const n = candles.length;
      const sarOut = nans(n);
      const signals: Signal[] = [];
      if (n >= 3) {
        let up = candles[1].close >= candles[0].close;
        let sar = up ? candles[0].low : candles[0].high;
        let ep = up ? candles[1].high : candles[1].low;
        let af = 0.02;
        sarOut[1] = sar;
        for (let i = 2; i < n; i++) {
          sar = sar + af * (ep - sar);
          sar = up
            ? Math.min(sar, candles[i - 1].low, candles[i - 2].low)
            : Math.max(sar, candles[i - 1].high, candles[i - 2].high);
          if (up) {
            if (candles[i].low < sar) {
              up = false;
              sar = ep;
              ep = candles[i].low;
              af = 0.02;
              signals.push({ index: i, side: "sell", label: "PSAR flip ↓" });
            } else if (candles[i].high > ep) {
              ep = candles[i].high;
              af = Math.min(af + 0.02, 0.2);
            }
          } else {
            if (candles[i].high > sar) {
              up = true;
              sar = ep;
              ep = candles[i].high;
              af = 0.02;
              signals.push({ index: i, side: "buy", label: "PSAR flip ↑" });
            } else if (candles[i].low < ep) {
              ep = candles[i].low;
              af = Math.min(af + 0.02, 0.2);
            }
          }
          sarOut[i] = sar;
        }
      }
      return {
        overlays: [{ name: "PSAR", ink: "yellowBright", ansi: asciichart.lightyellow, values: sarOut, style: "dots" }],
        signals,
        note: shortNote(3, n),
      };
    },
  },
  {
    key: "ST",
    label: "Supertrend 10, 3×ATR",
    desc: "ratcheting trend line — flip signals",
    compute(candles) {
      const n = candles.length;
      const atr = atrSeries(candles, 10);
      const st = nans(n);
      const signals: Signal[] = [];
      const start = atr.findIndex((v) => !isNaN(v));
      if (start >= 0 && start < n - 1) {
        let fUp = (candles[start].high + candles[start].low) / 2 + 3 * atr[start];
        let fLo = (candles[start].high + candles[start].low) / 2 - 3 * atr[start];
        let up: boolean = true;
        for (let i = start + 1; i < n; i++) {
          const hl2 = (candles[i].high + candles[i].low) / 2;
          const ub = hl2 + 3 * atr[i];
          const lb = hl2 - 3 * atr[i];
          fUp = ub < fUp || candles[i - 1].close > fUp ? ub : fUp;
          fLo = lb > fLo || candles[i - 1].close < fLo ? lb : fLo;
          const wasUp: boolean = up;
          if (candles[i].close > fUp) up = true;
          else if (candles[i].close < fLo) up = false;
          if (up !== wasUp) signals.push({ index: i, side: up ? "buy" : "sell", label: up ? "Supertrend ↑" : "Supertrend ↓" });
          st[i] = up ? fLo : fUp;
        }
      }
      return {
        overlays: [{ name: "ST", ink: "whiteBright", ansi: asciichart.white, values: st }],
        signals,
        note: shortNote(11, n),
      };
    },
  },
  {
    key: "PIV",
    label: "Pivot points",
    desc: "prior-period P/R1/S1 levels (classic)",
    compute(candles) {
      const n = candles.length;
      // infer bar size to pick the pivot period: session → prior day,
      // daily → prior month, weekly → prior year
      const spanDays = n > 1 ? (candles[n - 1].date.getTime() - candles[0].date.getTime()) / 864e5 / (n - 1) : 1;
      const keyOf = (d: Date) =>
        spanDays < 0.9 ? d.toDateString() : spanDays > 5 ? String(d.getFullYear()) : `${d.getFullYear()}-${d.getMonth()}`;
      const groups: Candle[][] = [];
      for (const c of candles) {
        const k = keyOf(c.date);
        if (!groups.length || keyOf(groups[groups.length - 1][0].date) !== k) groups.push([]);
        groups[groups.length - 1].push(c);
      }
      if (groups.length < 2) return { overlays: [], signals: [], note: "needs a prior period in the window" };
      const prev = groups[groups.length - 2];
      const high = Math.max(...prev.map((c) => c.high));
      const low = Math.min(...prev.map((c) => c.low));
      const close = prev[prev.length - 1].close;
      const p = (high + low + close) / 3;
      const r1 = 2 * p - low;
      const s1 = 2 * p - high;
      const flat = (v: number) => new Array<number>(n).fill(v);
      const closes = candles.map((c) => c.close);
      return {
        overlays: [
          { name: "R1", ink: "redBright", ansi: asciichart.lightred, values: flat(r1) },
          { name: "P", ink: "white", ansi: asciichart.lightgray, values: flat(p) },
          { name: "S1", ink: "greenBright", ansi: asciichart.lightgreen, values: flat(s1) },
        ],
        signals: [
          ...crossSignals(closes, flat(r1), "above R1", "x").filter((s) => s.side === "buy"),
          ...crossSignals(closes, flat(s1), "x", "below S1").filter((s) => s.side === "sell"),
        ],
      };
    },
  },
  {
    key: "RSI",
    label: "RSI 14 (30/70)",
    desc: "oversold/overbought exits — signal only",
    compute(candles) {
      const closes = candles.map((c) => c.close);
      const gains = closes.map((c, i) => (i === 0 ? 0 : Math.max(0, c - closes[i - 1])));
      const losses = closes.map((c, i) => (i === 0 ? 0 : Math.max(0, closes[i - 1] - c)));
      const ag = wilderSmooth(gains.slice(1), 14);
      const al = wilderSmooth(losses.slice(1), 14);
      const rsi = nans(closes.length);
      for (let i = 0; i < ag.length; i++) {
        if (isNaN(ag[i]) || isNaN(al[i])) continue;
        rsi[i + 1] = al[i] === 0 ? 100 : 100 - 100 / (1 + ag[i] / al[i]);
      }
      const flat = (v: number) => new Array<number>(closes.length).fill(v);
      return {
        overlays: [],
        signals: [
          ...crossSignals(rsi, flat(30), "RSI exits oversold ↑", "x").filter((s) => s.side === "buy"),
          ...crossSignals(flat(70), rsi, "x", "?").filter((s) => s.side === "buy").map((s) => ({
            ...s, side: "sell" as const, label: "RSI exits overbought ↓",
          })),
        ],
        note: shortNote(15, closes.length),
      };
    },
  },
  {
    key: "MACD",
    label: "MACD 12/26/9",
    desc: "MACD vs signal line cross — signal only",
    compute(candles) {
      const closes = candles.map((c) => c.close);
      const slow = emaSeries(closes, 26);
      const macd = emaSeries(closes, 12).map((f, i) => f - slow[i]);
      const signal = emaOf(macd, 9);
      return {
        overlays: [],
        signals: crossSignals(macd, signal, "MACD bull cross", "MACD bear cross"),
        note: shortNote(35, closes.length),
      };
    },
  },
  {
    key: "STOCH",
    label: "Stochastic 14,3,3",
    desc: "%K/%D cross in extreme zones — signal only",
    compute(candles) {
      const closes = candles.map((c) => c.close);
      const hh = highest(candles.map((c) => c.high), 14);
      const ll = lowest(candles.map((c) => c.low), 14);
      const rawK = closes.map((c, i) => (hh[i] - ll[i] ? ((c - ll[i]) / (hh[i] - ll[i])) * 100 : NaN));
      const k = smaOfDefined(rawK, 3);
      const d = smaOfDefined(k, 3);
      const crosses = crossSignals(k, d, "stoch bull cross", "stoch bear cross");
      return {
        overlays: [],
        signals: crosses.filter((s) => (s.side === "buy" ? d[s.index] < 25 : d[s.index] > 75)),
        note: shortNote(18, closes.length),
      };
    },
  },
  {
    key: "CCI",
    label: "CCI 20 (±100)",
    desc: "commodity channel index breakouts — signal only",
    compute(candles) {
      const tp = typicalPrice(candles);
      const ma = smaSeries(tp, 20);
      const cci = nans(tp.length);
      for (let i = 19; i < tp.length; i++) {
        const slice = tp.slice(i - 19, i + 1);
        const md = slice.reduce((a, b) => a + Math.abs(b - ma[i]), 0) / 20;
        cci[i] = md ? (tp[i] - ma[i]) / (0.015 * md) : NaN;
      }
      const flat = (v: number) => new Array<number>(tp.length).fill(v);
      return {
        overlays: [],
        signals: [
          ...crossSignals(cci, flat(100), "CCI +100 ↑", "x").filter((s) => s.side === "buy"),
          ...crossSignals(flat(-100), cci, "x", "?").filter((s) => s.side === "buy").map((s) => ({
            ...s, side: "sell" as const, label: "CCI −100 ↓",
          })),
        ],
        note: shortNote(20, tp.length),
      };
    },
  },
  {
    key: "ADX",
    label: "ADX 14 + DI cross",
    desc: "DI cross with trend strength >20 — signal only",
    compute(candles) {
      const n = candles.length;
      if (n < 30) return { overlays: [], signals: [], note: shortNote(30, n) };
      const plusDM: number[] = [];
      const minusDM: number[] = [];
      const tr = trueRange(candles).slice(1);
      for (let i = 1; i < n; i++) {
        const upMove = candles[i].high - candles[i - 1].high;
        const downMove = candles[i - 1].low - candles[i].low;
        plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
        minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
      }
      const atr = wilderSmooth(tr, 14);
      const pdi = wilderSmooth(plusDM, 14).map((v, i) => (atr[i] ? (100 * v) / atr[i] : NaN));
      const mdi = wilderSmooth(minusDM, 14).map((v, i) => (atr[i] ? (100 * v) / atr[i] : NaN));
      const dx = pdi.map((p, i) => (p + mdi[i] ? (100 * Math.abs(p - mdi[i])) / (p + mdi[i]) : NaN));
      const adx = wilderSmooth(dx.filter((v) => !isNaN(v)), 14);
      // re-align adx to full length (defined values start after 2×14 warm-up)
      const adxFull = nans(n);
      const firstDx = dx.findIndex((v) => !isNaN(v));
      for (let i = 0; i < adx.length; i++) if (!isNaN(adx[i])) adxFull[firstDx + i + 1] = adx[i];
      const pdiFull = nans(n);
      const mdiFull = nans(n);
      for (let i = 0; i < pdi.length; i++) {
        pdiFull[i + 1] = pdi[i];
        mdiFull[i + 1] = mdi[i];
      }
      return {
        overlays: [],
        signals: crossSignals(pdiFull, mdiFull, "+DI cross (trend ↑)", "−DI cross (trend ↓)").filter(
          (s) => (adxFull[s.index] ?? 0) > 20,
        ),
      };
    },
  },
];

/** SMA over a series that may have NaN warm-up. */
function smaOfDefined(values: number[], window: number): number[] {
  const out = nans(values.length);
  for (let i = window - 1; i < values.length; i++) {
    const slice = values.slice(i - window + 1, i + 1);
    if (slice.some(isNaN)) continue;
    out[i] = slice.reduce((a, b) => a + b, 0) / window;
  }
  return out;
}

export const STRATEGY_KEYS = STRATEGIES.map((s) => s.key);

/** Replace NaN warm-up with the first defined value so asciichart can plot. */
export function padWarmup(values: number[]): number[] {
  const first = values.find((v) => !isNaN(v));
  if (first == null) return values.map(() => NaN);
  return values.map((v) => (isNaN(v) ? first : v));
}

const FILE = join(homedir(), ".config", "bloommountain", "strategies.json");

export function loadActiveStrategies(): string[] {
  try {
    const data = JSON.parse(readFileSync(FILE, "utf8"));
    if (Array.isArray(data)) return data.filter((k) => STRATEGY_KEYS.includes(String(k)));
  } catch {
    /* first run */
  }
  return [];
}

export function saveActiveStrategies(keys: string[]): void {
  try {
    mkdirSync(join(homedir(), ".config", "bloommountain"), { recursive: true });
    writeFileSync(FILE, JSON.stringify(keys, null, 2));
  } catch {
    /* non-fatal */
  }
}
