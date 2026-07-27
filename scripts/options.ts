/**
 * Options analyst: chain summary at the nearest expiry — implied move, IV,
 * put/call ratios, open-interest walls, unusual volume.
 * Usage: npx tsx scripts/options.ts SYMBOL [--exp YYYY-MM-DD]
 */
import { fmtPrice } from "../src/lib/format.js";
import { chainSummary } from "./lib/opts.js";

const symbol = process.argv[2]?.toUpperCase();
if (!symbol) {
  console.error("usage: tsx scripts/options.ts SYMBOL [--exp YYYY-MM-DD]");
  process.exit(1);
}
const ei = process.argv.indexOf("--exp");
const after = ei > 0 && process.argv[ei + 1] ? new Date(process.argv[ei + 1]) : undefined;

const c = await chainSummary(symbol, after);
const dte = Math.max(0, Math.round((c.expiry.getTime() - Date.now()) / 864e5));

console.log(`# ${symbol} — options (expiry ${c.expiry.toISOString().slice(0, 10)}, ${dte} DTE)\n`);
console.log(`| metric | value |`);
console.log(`|---|---|`);
console.log(`| Spot | ${fmtPrice(c.spot)} |`);
console.log(`| ATM strike | ${fmtPrice(c.atmStrike)} |`);
console.log(`| ATM IV | ${c.atmIV != null ? (c.atmIV * 100).toFixed(0) + "%" : "–"} |`);
console.log(`| Implied move by expiry | ${c.impliedMovePct != null ? "±" + (c.impliedMovePct * 100).toFixed(1) + "%" : "–"} |`);
console.log(`| Put/Call (volume) | ${c.putCallVolume?.toFixed(2) ?? "–"} |`);
console.log(`| Put/Call (open interest) | ${c.putCallOI?.toFixed(2) ?? "–"} |`);
console.log(`\n## Open-interest walls\n`);
console.log(`Calls: ${c.topCallOI.map((w) => `${fmtPrice(w.strike)} (${w.oi.toLocaleString()})`).join(" · ") || "–"}`);
console.log(`Puts:  ${c.topPutOI.map((w) => `${fmtPrice(w.strike)} (${w.oi.toLocaleString()})`).join(" · ") || "–"}`);
if (c.unusual.length) {
  console.log(`\n## Unusual volume (volume > 3× OI, > 500 contracts)\n`);
  for (const u of c.unusual)
    console.log(`- ${u.type.toUpperCase()} ${fmtPrice(u.strike)}: ${u.volume.toLocaleString()} traded vs ${u.oi.toLocaleString()} OI`);
} else {
  console.log(`\nNo unusual volume at this expiry.`);
}
console.log(
  `\n_P/C around 0.7 is typical, not neutral (structural call skew). OI walls often act as magnets/pins into expiry. Unusual volume is a hint, not a signal — could be hedges or spreads._`,
);
