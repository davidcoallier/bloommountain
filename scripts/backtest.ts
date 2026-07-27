/**
 * Backtester: replay each strategy's signals (long on buy, flat on sell)
 * against history and compare with buy & hold.
 * Usage: npx tsx scripts/backtest.ts SYMBOL [--strategy KEY] [--period 1Y|5Y]
 */
import { fetchCandles } from "../src/lib/yahoo.js";
import { STRATEGIES } from "../src/lib/strategies.js";
import { fmtPct } from "../src/lib/format.js";
import type { PeriodKey } from "../src/lib/periods.js";

const symbol = process.argv[2]?.toUpperCase();
if (!symbol) {
  console.error("usage: tsx scripts/backtest.ts SYMBOL [--strategy KEY] [--period 1Y|5Y]");
  process.exit(1);
}
const si = process.argv.indexOf("--strategy");
const only = si > 0 ? process.argv[si + 1]?.toUpperCase() : null;
const pi = process.argv.indexOf("--period");
const period = (pi > 0 ? process.argv[pi + 1]?.toUpperCase() : "5Y") as PeriodKey;

const candles = await fetchCandles(symbol, period);
if (candles.length < 60) {
  console.error(`not enough history (${candles.length} bars)`);
  process.exit(1);
}
const closes = candles.map((c) => c.close);
const buyHold = closes[closes.length - 1] / closes[0] - 1;

interface Result {
  key: string;
  trades: number;
  winRate: number | null;
  totalReturn: number;
  exposure: number;
  maxDD: number;
}

function run(key: string): Result | null {
  const st = STRATEGIES.find((s) => s.key === key);
  if (!st) return null;
  const { signals } = st.compute(candles);
  const ordered = [...signals].sort((a, b) => a.index - b.index);
  let inPos = false;
  let entry = 0;
  const tradeReturns: number[] = [];
  let barsIn = 0;
  let lastEntryIdx = 0;
  for (const sig of ordered) {
    if (sig.side === "buy" && !inPos) {
      inPos = true;
      entry = closes[sig.index];
      lastEntryIdx = sig.index;
    } else if (sig.side === "sell" && inPos) {
      inPos = false;
      tradeReturns.push(closes[sig.index] / entry - 1);
      barsIn += sig.index - lastEntryIdx;
    }
  }
  if (inPos) {
    tradeReturns.push(closes[closes.length - 1] / entry - 1);
    barsIn += closes.length - 1 - lastEntryIdx;
  }
  if (!tradeReturns.length) return { key, trades: 0, winRate: null, totalReturn: 0, exposure: 0, maxDD: 0 };

  // equity curve for drawdown: in-market segments compound, flat otherwise
  let equity = 1;
  let peak = 1;
  let maxDD = 0;
  let pos = false;
  let entryPx = 0;
  let entryEq = 1;
  const sigByIdx = new Map(ordered.map((s) => [s.index, s.side] as const));
  for (let i = 0; i < closes.length; i++) {
    const side = sigByIdx.get(i);
    if (side === "buy" && !pos) {
      pos = true;
      entryPx = closes[i];
      entryEq = equity;
    } else if (side === "sell" && pos) {
      pos = false;
      equity = entryEq * (closes[i] / entryPx);
    }
    const mark = pos ? entryEq * (closes[i] / entryPx) : equity;
    peak = Math.max(peak, mark);
    maxDD = Math.min(maxDD, mark / peak - 1);
  }
  if (pos) equity = entryEq * (closes[closes.length - 1] / entryPx);

  return {
    key,
    trades: tradeReturns.length,
    winRate: tradeReturns.filter((r) => r > 0).length / tradeReturns.length,
    totalReturn: equity - 1,
    exposure: barsIn / closes.length,
    maxDD,
  };
}

const keys = only ? [only] : STRATEGIES.map((s) => s.key);
const results = keys.map(run).filter((r): r is Result => r != null);

console.log(`# ${symbol} — strategy backtest, ${period} (${candles.length} bars)\n`);
console.log(`Buy & hold over the window: **${fmtPct(buyHold * 100)}**\n`);
console.log(`| strategy | trades | win rate | return | max DD | time in market |`);
console.log(`|---|---|---|---|---|---|`);
for (const r of results.sort((a, b) => b.totalReturn - a.totalReturn)) {
  console.log(
    `| ${r.key} | ${r.trades} | ${r.winRate != null ? (r.winRate * 100).toFixed(0) + "%" : "–"} | ${fmtPct(r.totalReturn * 100)} | ${fmtPct(r.maxDD * 100)} | ${(r.exposure * 100).toFixed(0)}% |`,
  );
}
console.log(
  `\n_Long-only, signal-close fills, no costs/slippage/dividends — treat as strategy comparison, not performance promise. One symbol, one window: survivorship and overfit risk apply._`,
);
