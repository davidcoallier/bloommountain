/**
 * Cross-asset connector: how one symbol trades against the macro complex —
 * commodities, dollar, rates, index — plus the news flow around the assets
 * it's most correlated with. Feeds "why is X moving" analysis.
 *
 * Usage: npx tsx scripts/connector.ts SYMBOL [--days N]
 */
import { fetchDailyCloses, fetchNews } from "../src/lib/yahoo.js";
import { fmtNum } from "../src/lib/format.js";
import { beta, correlation, dailyReturns } from "./lib/stats.js";

const symbol = process.argv[2]?.toUpperCase();
if (!symbol) {
  console.error("usage: tsx scripts/connector.ts SYMBOL [--days N]");
  process.exit(1);
}
const di = process.argv.indexOf("--days");
const days = di > 0 && process.argv[di + 1] ? Number(process.argv[di + 1]) : 180;

const BASKET: [string, string][] = [
  ["^GSPC", "S&P 500"],
  ["^TNX", "US 10Y yield"],
  ["DX-Y.NYB", "Dollar index"],
  ["CL=F", "WTI crude"],
  ["BZ=F", "Brent crude"],
  ["NG=F", "Nat gas"],
  ["GC=F", "Gold"],
  ["HG=F", "Copper"],
  ["BTC-USD", "Bitcoin"],
  ["EURUSD=X", "EUR/USD"],
];

const targetSeries = await fetchDailyCloses(symbol, days);
if (targetSeries.length < 30) {
  console.error(`not enough history for ${symbol}`);
  process.exit(1);
}
const targetByDate = new Map(targetSeries.map((r) => [r.date.toDateString(), r.close]));

const results: { symbol: string; label: string; corr: number; n: number }[] = [];
let spxBeta: number | null = null;

for (const [sym, label] of BASKET) {
  if (sym === symbol) continue;
  try {
    const series = await fetchDailyCloses(sym, days);
    // align on shared trading days before computing return correlation
    const paired = series
      .map((r) => [targetByDate.get(r.date.toDateString()), r.close] as const)
      .filter((p): p is readonly [number, number] => p[0] != null);
    const a = dailyReturns(paired.map((p) => p[0]));
    const b = dailyReturns(paired.map((p) => p[1]));
    const c = correlation(a, b);
    if (isFinite(c)) results.push({ symbol: sym, label, corr: c, n: a.length });
    if (sym === "^GSPC") {
      const bb = beta(a, b);
      if (isFinite(bb)) spxBeta = bb;
    }
  } catch {
    /* asset unavailable — skip */
  }
}

results.sort((x, y) => Math.abs(y.corr) - Math.abs(x.corr));

console.log(`# ${symbol} — cross-asset map (${days}d daily returns)\n`);
if (spxBeta != null) console.log(`Beta vs S&P 500: **${fmtNum(spxBeta, 2)}**\n`);
console.log(`| asset | correlation | strength |`);
console.log(`|---|---|---|`);
for (const r of results) {
  const bars = "█".repeat(Math.round(Math.abs(r.corr) * 10)).padEnd(10, "░");
  const sign = r.corr >= 0 ? "+" : "−";
  console.log(`| ${r.label} (${r.symbol}) | ${fmtNum(r.corr, 2)} | ${sign} ${bars} |`);
}

const top = results.filter((r) => Math.abs(r.corr) >= 0.25).slice(0, 2);
const newsTargets = [symbol, ...top.map((r) => r.symbol)];
console.log(`\n## News flow: ${newsTargets.join(", ")}\n`);
for (const sym of newsTargets) {
  const items = await fetchNews(sym, 4);
  console.log(`### ${sym}`);
  for (const n of items) console.log(`- ${n.title} — ${n.publisher} (${n.published?.toISOString().slice(0, 10) ?? "?"})`);
  console.log("");
}

console.log(
  `_Correlation over ${days} days of aligned daily log returns (n varies per pair). Correlation ≠ causation; use the news flow above to judge the actual channel._`,
);
