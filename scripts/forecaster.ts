/**
 * Statistical forecast pack: realized vol, trend, momentum, drawdown,
 * and a Monte Carlo (GBM) price cone for one symbol.
 *
 * Usage: npx tsx scripts/forecaster.ts SYMBOL [--days N] [--paths N]
 */
import { fetchDailyCloses, fetchQuote } from "../src/lib/yahoo.js";
import { fmtNum, fmtPct, fmtPrice } from "../src/lib/format.js";
import {
  TRADING_DAYS,
  dailyReturns,
  maxDrawdown,
  mean,
  monteCarloGBM,
  rsi,
  sma,
  stdev,
} from "./lib/stats.js";

function arg(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  return i > 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : fallback;
}

const symbol = process.argv[2]?.toUpperCase();
if (!symbol) {
  console.error("usage: tsx scripts/forecaster.ts SYMBOL [--days N] [--paths N]");
  process.exit(1);
}
const horizon = arg("--days", 30);
const paths = arg("--paths", 5000);

const [series, quote] = await Promise.all([fetchDailyCloses(symbol, 550), fetchQuote(symbol)]);
const closes = series.map((s) => s.close);
if (closes.length < 60) {
  console.error(`not enough history for ${symbol} (${closes.length} bars)`);
  process.exit(1);
}

const rets = dailyReturns(closes);
const spot = quote.price ?? closes[closes.length - 1];
const muD = mean(rets);
const sigD = stdev(rets);
const annVol = sigD * Math.sqrt(TRADING_DAYS);
const annRet = muD * TRADING_DAYS;

const s20 = sma(closes, 20);
const s50 = sma(closes, 50);
const s200 = sma(closes, 200);
const r14 = rsi(closes);
const mdd = maxDrawdown(closes);
const mc = monteCarloGBM(spot, muD, sigD, horizon, paths);

const trendRead =
  s50 && s200
    ? spot > s50 && s50 > s200
      ? "uptrend (price > SMA50 > SMA200)"
      : spot < s50 && s50 < s200
        ? "downtrend (price < SMA50 < SMA200)"
        : "mixed"
    : "insufficient history";

const rsiRead = r14 == null ? "–" : r14 > 70 ? "overbought" : r14 < 30 ? "oversold" : "neutral";

console.log(
  [
    `# ${symbol} — forecast pack (${horizon} trading days, ${paths} GBM paths)`,
    ``,
    `Spot ${fmtPrice(spot)} · sample ${closes.length} daily bars (~${Math.round(closes.length / 21)} months)`,
    ``,
    `## Realized statistics`,
    `| metric | value |`,
    `|---|---|`,
    `| Annualized return (drift) | ${fmtPct(annRet * 100)} |`,
    `| Annualized volatility | ${fmtPct(annVol * 100, false)} |`,
    `| Max drawdown (sample) | ${fmtPct(mdd * 100)} |`,
    `| RSI(14) | ${r14 == null ? "–" : fmtNum(r14, 0)} (${rsiRead}) |`,
    `| SMA20 / SMA50 / SMA200 | ${fmtPrice(s20)} / ${fmtPrice(s50)} / ${fmtPrice(s200)} |`,
    `| Trend | ${trendRead} |`,
    ``,
    `## Monte Carlo price cone (${horizon}d)`,
    `| percentile | price | vs spot |`,
    `|---|---|---|`,
    `| p95 | ${fmtPrice(mc.p95)} | ${fmtPct((mc.p95 / spot - 1) * 100)} |`,
    `| p75 | ${fmtPrice(mc.p75)} | ${fmtPct((mc.p75 / spot - 1) * 100)} |`,
    `| p50 | ${fmtPrice(mc.p50)} | ${fmtPct((mc.p50 / spot - 1) * 100)} |`,
    `| p25 | ${fmtPrice(mc.p25)} | ${fmtPct((mc.p25 / spot - 1) * 100)} |`,
    `| p5 | ${fmtPrice(mc.p5)} | ${fmtPct((mc.p5 / spot - 1) * 100)} |`,
    ``,
    `P(price > spot in ${horizon}d) ≈ ${fmtPct(mc.probAboveSpot * 100, false)}`,
    ``,
    `_GBM assumes returns are i.i.d. lognormal — it extrapolates the sample drift/vol and knows nothing about earnings dates, macro, or regime change. Treat the cone as a volatility framing, not a prediction._`,
  ].join("\n"),
);
