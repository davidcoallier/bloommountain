/**
 * Macro economist: yield curve + spreads, dollar/commodities/crypto tape,
 * implied fed funds rate, and the macro-tagged news wire.
 * Usage: npx tsx scripts/macro.ts
 */
import { fetchQuotes } from "../src/lib/yahoo.js";
import { fetchFuturesBoard } from "../src/lib/futures.js";
import { fetchWire } from "../src/lib/wire.js";
import { fmtPct, fmtPrice } from "../src/lib/format.js";

const [curve, tape, board, wire] = await Promise.all([
  fetchQuotes(["^IRX", "^FVX", "^TNX", "^TYX"]),
  fetchQuotes(["DX-Y.NYB", "EURUSD=X", "GC=F", "CL=F", "BTC-USD", "^VIX"]),
  fetchFuturesBoard(),
  fetchWire(25),
]);

const [m3, y5, y10, y30] = curve.map((q) => q.price);

console.log(`# Macro dashboard\n`);
console.log(`## US yield curve\n`);
console.log(`| tenor | yield |`);
console.log(`|---|---|`);
console.log(`| 3M (^IRX) | ${m3?.toFixed(2) ?? "–"}% |`);
console.log(`| 5Y (^FVX) | ${y5?.toFixed(2) ?? "–"}% |`);
console.log(`| 10Y (^TNX) | ${y10?.toFixed(2) ?? "–"}% |`);
console.log(`| 30Y (^TYX) | ${y30?.toFixed(2) ?? "–"}% |`);
if (m3 != null && y10 != null) {
  const spread = y10 - m3;
  console.log(
    `\n10Y−3M spread: **${spread >= 0 ? "+" : ""}${spread.toFixed(2)}pp** — ${
      spread < 0 ? "inverted (classic recession precursor)" : "positively sloped"
    }`,
  );
}
if (board.impliedFedRate != null) {
  console.log(`Fed funds futures imply an average rate of **${board.impliedFedRate.toFixed(2)}%** (100 − ZQ=F).`);
}

console.log(`\n## Macro tape\n`);
console.log(`| asset | last | day |`);
console.log(`|---|---|---|`);
const labels = ["Dollar index", "EUR/USD", "Gold", "WTI crude", "Bitcoin", "VIX"];
tape.forEach((q, i) => console.log(`| ${labels[i]} | ${fmtPrice(q.price)} | ${fmtPct(q.pct)} |`));

const macroNews = wire.filter((w) => w.tags.some((t) => ["fed", "macro", "fx"].includes(t))).slice(0, 8);
if (macroNews.length) {
  console.log(`\n## Macro wire\n`);
  for (const w of macroNews)
    console.log(`- ${w.title} — ${w.source}${w.published ? `, ${w.published.toISOString().slice(0, 10)}` : ""}`);
}

console.log(`\n_Yahoo's ^IRX/^FVX/^TNX/^TYX quote in yield points. No 2Y ticker on Yahoo, so the classic 10Y−2Y spread is approximated here by 10Y−3M._`);
