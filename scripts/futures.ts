/**
 * Futures desk data pack: grouped futures board, macro prediction-market
 * odds (Polymarket + Kalshi), and the multi-source commodity news wire.
 *
 * Usage: npx tsx scripts/futures.ts [--json]
 */
import { fetchFuturesBoard } from "../src/lib/futures.js";
import { fetchPredictions } from "../src/lib/predictions.js";
import { fetchWire } from "../src/lib/wire.js";
import { fmtBig, fmtPct, fmtPrice } from "../src/lib/format.js";

const [board, preds, wire] = await Promise.all([
  fetchFuturesBoard(),
  fetchPredictions(12),
  fetchWire(20),
]);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ board, predictions: preds, wire }, null, 2));
  process.exit(0);
}

console.log(`# Futures desk\n`);
console.log(`## Board\n`);
console.log(`| group | contracts |`);
console.log(`|---|---|`);
for (const g of board.groups) {
  console.log(
    `| ${g.group} | ${g.entries
      .map((e) => `${e.label} ${fmtPrice(e.quote.price)} (${fmtPct(e.quote.pct)})`)
      .join(" · ")} |`,
  );
}
if (board.impliedFedRate != null) {
  console.log(`\nFed funds futures imply an average rate of **${board.impliedFedRate.toFixed(2)}%** (100 − ZQ=F front month).`);
}

console.log(`\n## Prediction markets (macro, by 24h volume)\n`);
console.log(`| odds | event | source | 24h vol | resolves |`);
console.log(`|---|---|---|---|---|`);
for (const p of preds) {
  console.log(
    `| ${Math.round(p.prob * 100)}% | ${p.question} | ${p.source} | $${fmtBig(p.volume24h)} | ${p.endDate?.toISOString().slice(0, 10) ?? "?"} |`,
  );
}

console.log(`\n## Wire (OilPrice + CNBC + MarketWatch, deduped)\n`);
for (const w of wire) {
  const t = w.published ? w.published.toISOString().slice(0, 16).replace("T", " ") : "?";
  console.log(`- ${w.title} — ${w.source}, ${t}${w.tags.length ? ` [${w.tags.join(",")}]` : ""}`);
}

console.log(
  `\n_Prediction-market odds are prices, not truths: they carry fees, liquidity limits, and crowd bias. Quotes delayed per exchange rules._`,
);
