/**
 * Portfolio risk: exposure, P&L, correlations, vol, VaR, concentration.
 * Positions live in ~/.config/bloommountain/portfolio.json (created on first run).
 * Usage: npx tsx scripts/portfolio.ts [--file path]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fetchDailyCloses, fetchQuotes, yf } from "../src/lib/yahoo.js";
import { fmtBig, fmtPct, fmtPrice } from "../src/lib/format.js";
import { beta, correlation, dailyReturns, TRADING_DAYS } from "./lib/stats.js";

const fi = process.argv.indexOf("--file");
const usePaper = process.argv.includes("--paper");
const FILE = fi > 0 && process.argv[fi + 1] ? process.argv[fi + 1] : join(homedir(), ".config", "bloommountain", usePaper ? "paper.json" : "portfolio.json");

interface Position {
  symbol: string;
  qty: number;
  cost: number; // per-share cost basis
}

if (!existsSync(FILE)) {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(
    FILE,
    JSON.stringify(
      { positions: [{ symbol: "AAPL", qty: 10, cost: 180.0 }, { symbol: "MSFT", qty: 5, cost: 300.0 }] },
      null,
      2,
    ),
  );
  console.log(`Created a template at ${FILE} — edit it with your real positions (qty + per-share cost), then re-run.`);
  process.exit(0);
}

const rawBook = JSON.parse(readFileSync(FILE, "utf8"));
const positions: Position[] = usePaper
  ? (rawBook.positions ?? []).map((p: { symbol: string; qty: number; avgCost: number }) => ({ symbol: p.symbol, qty: p.qty, cost: p.avgCost }))
  : (rawBook.positions ?? []);
if (!positions.length) {
  console.error(usePaper ? "paper book is empty — BUY something first" : `no positions in ${FILE}`);
  process.exit(usePaper ? 0 : 1);
}

const symbols = positions.map((p) => p.symbol.toUpperCase());
const [quotes, ...histories] = await Promise.all([
  fetchQuotes(symbols),
  ...symbols.map((s) => fetchDailyCloses(s, 190)),
  fetchDailyCloses("^GSPC", 190),
]);
const spxHist = histories.pop()!;

// sector per holding (best effort)
const sectors = await Promise.all(
  symbols.map(async (s) => {
    try {
      const qs = (await yf.quoteSummary(s, { modules: ["assetProfile"] })) as { assetProfile?: { sector?: string } };
      return qs.assetProfile?.sector ?? "Other";
    } catch {
      return "Other";
    }
  }),
);

const rows = positions.map((p, i) => {
  const price = quotes[i].price ?? 0;
  const value = price * p.qty;
  const costBasis = p.cost * p.qty;
  return { ...p, symbol: symbols[i], price, value, costBasis, pnl: value - costBasis, dayPct: quotes[i].pct ?? 0, sector: sectors[i] };
});
const total = rows.reduce((a, r) => a + r.value, 0);
const totalCost = rows.reduce((a, r) => a + r.costBasis, 0);

console.log(`# Portfolio — ${rows.length} positions, ${fmtBig(total)} market value\n`);
console.log(`| symbol | qty | price | value | weight | P&L | P&L% | day | sector |`);
console.log(`|---|---|---|---|---|---|---|---|---|`);
for (const r of [...rows].sort((a, b) => b.value - a.value)) {
  console.log(
    `| ${r.symbol} | ${r.qty} | ${fmtPrice(r.price)} | ${fmtBig(r.value)} | ${((r.value / total) * 100).toFixed(1)}% | ${fmtBig(r.pnl)} | ${fmtPct((r.value / r.costBasis - 1) * 100)} | ${fmtPct(r.dayPct)} | ${r.sector} |`,
  );
}
console.log(`\nTotal P&L: **${fmtBig(total - totalCost)}** (${fmtPct((total / totalCost - 1) * 100)} on cost)`);

// sector concentration
const bySector = new Map<string, number>();
for (const r of rows) bySector.set(r.sector, (bySector.get(r.sector) ?? 0) + r.value);
console.log(`\n## Concentration\n`);
console.log(
  [...bySector.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([s, v]) => `${s} ${((v / total) * 100).toFixed(0)}%`)
    .join(" · "),
);
const top = Math.max(...rows.map((r) => r.value)) / total;
const hhi = rows.reduce((a, r) => a + (r.value / total) ** 2, 0);
console.log(`Largest position ${(top * 100).toFixed(0)}% of book · HHI ${hhi.toFixed(2)} (1/HHI ≈ ${(1 / hhi).toFixed(1)} effective positions)`);

// correlations + portfolio vol/VaR
const returnsBySym = histories.map((h) => dailyReturns(h.map((x) => x.close)));
const weights = rows.map((r) => r.value / total);
console.log(`\n## Correlations (6mo daily)\n`);
console.log(`| | ${symbols.join(" | ")} |`);
console.log(`|---|${symbols.map(() => "---|").join("")}`);
for (let i = 0; i < symbols.length; i++) {
  const cells = symbols.map((_, j) => (i === j ? "—" : correlation(returnsBySym[i], returnsBySym[j]).toFixed(2)));
  console.log(`| **${symbols[i]}** | ${cells.join(" | ")} |`);
}

const n = Math.min(...returnsBySym.map((r) => r.length));
const port: number[] = [];
for (let t = 0; t < n; t++) {
  let r = 0;
  for (let i = 0; i < symbols.length; i++) r += weights[i] * returnsBySym[i][returnsBySym[i].length - n + t];
  port.push(r);
}
const mean = port.reduce((a, b) => a + b, 0) / port.length;
const sd = Math.sqrt(port.reduce((a, b) => a + (b - mean) ** 2, 0) / (port.length - 1));
const spxR = dailyReturns(spxHist.map((x) => x.close));
const portBeta = beta(port, spxR.slice(-port.length));

console.log(`\n## Risk\n`);
console.log(`| metric | value |`);
console.log(`|---|---|`);
console.log(`| Annualized vol | ${fmtPct(sd * Math.sqrt(TRADING_DAYS) * 100, false)} |`);
console.log(`| 1-day VaR 95% (parametric) | ${fmtBig(1.645 * sd * total)} |`);
console.log(`| Beta vs S&P 500 | ${isFinite(portBeta) ? portBeta.toFixed(2) : "–"} |`);
console.log(
  `\n_Parametric VaR assumes normal returns — real tails are fatter. Correlations are a 6-month window and rise in selloffs, exactly when you need them not to._`,
);
