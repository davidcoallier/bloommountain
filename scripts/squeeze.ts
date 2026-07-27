/**
 * Short-squeeze scanner: short interest, days-to-cover, month-over-month
 * change, and the price/volume context.
 * Usage: npx tsx scripts/squeeze.ts SYMBOL
 */
import { yf, fetchCandles } from "../src/lib/yahoo.js";
import { fmtBig, fmtNum, fmtPct, fmtPrice } from "../src/lib/format.js";

const symbol = process.argv[2]?.toUpperCase();
if (!symbol) {
  console.error("usage: tsx scripts/squeeze.ts SYMBOL");
  process.exit(1);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const qs: any = await yf.quoteSummary(symbol, { modules: ["defaultKeyStatistics", "price", "summaryDetail"] });
const ks = qs.defaultKeyStatistics ?? {};
const candles = await fetchCandles(symbol, "1M");
const last = candles[candles.length - 1];
const monthAgo = candles[0];

console.log(`# ${symbol} — short interest${qs.price?.shortName ? ` (${qs.price.shortName})` : ""}\n`);
console.log(`| metric | value |`);
console.log(`|---|---|`);
console.log(`| Shares short | ${fmtBig(ks.sharesShort)} |`);
console.log(`| Short % of float | ${ks.shortPercentOfFloat != null ? fmtPct(ks.shortPercentOfFloat * 100, false) : "–"} |`);
console.log(`| Days to cover (short ratio) | ${ks.shortRatio != null ? fmtNum(ks.shortRatio, 1) : "–"} |`);
// Yahoo occasionally reports the prior month in wrong units — sanity-check vs float
const priorOk = ks.sharesShortPriorMonth && (!ks.floatShares || ks.sharesShortPriorMonth < ks.floatShares * 2);
console.log(`| Prior month shares short | ${priorOk ? fmtBig(ks.sharesShortPriorMonth) : "– (bad data from Yahoo)"} |`);
if (ks.sharesShort && priorOk) {
  console.log(`| M/M change | ${fmtPct((ks.sharesShort / ks.sharesShortPriorMonth - 1) * 100)} |`);
}
console.log(`| Float | ${fmtBig(ks.floatShares)} |`);
console.log(`| Price (1M change) | ${fmtPrice(last?.close)} (${monthAgo && last ? fmtPct((last.close / monthAgo.close - 1) * 100) : "–"}) |`);

const pctFloat = (ks.shortPercentOfFloat ?? 0) * 100;
const dtc = ks.shortRatio ?? 0;
const verdict =
  pctFloat > 20 && dtc > 5
    ? "High squeeze fuel: crowded short with slow exit."
    : pctFloat > 10 || dtc > 5
      ? "Moderate short interest — fuel exists but not crowded."
      : "Low short interest — no squeeze setup here.";
console.log(`\n${verdict}`);
console.log(
  `\n_Short interest is exchange-reported twice a month with a lag; borrow fees aren't public for free. High short interest is fuel, not a spark — it needs a catalyst (see earnings-scout) and often marks companies that deserve the shorts._`,
);
