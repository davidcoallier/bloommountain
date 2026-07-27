/**
 * Financial analyst data pack: fundamentals, valuation, profitability,
 * growth, balance-sheet health, and street view for one symbol.
 *
 * Usage: npx tsx scripts/analyst.ts SYMBOL [--json]
 */
import { yf } from "../src/lib/yahoo.js";
import { fmtBig, fmtNum, fmtPct } from "../src/lib/format.js";

const symbol = process.argv[2]?.toUpperCase();
const asJson = process.argv.includes("--json");
if (!symbol) {
  console.error("usage: tsx scripts/analyst.ts SYMBOL [--json]");
  process.exit(1);
}

const qs = await yf.quoteSummary(symbol, {
  modules: [
    "price",
    "summaryDetail",
    "financialData",
    "defaultKeyStatistics",
    "assetProfile",
    "earningsTrend",
    "recommendationTrend",
  ],
});

if (asJson) {
  console.log(JSON.stringify(qs, null, 2));
  process.exit(0);
}

/* Yahoo's quoteSummary payloads are loosely typed — treat as dynamic. */
/* eslint-disable @typescript-eslint/no-explicit-any */
const p: any = qs.price ?? {};
const sd: any = qs.summaryDetail ?? {};
const fd: any = qs.financialData ?? {};
const ks: any = qs.defaultKeyStatistics ?? {};
const ap: any = qs.assetProfile ?? {};
const trend: any[] = qs.earningsTrend?.trend ?? [];
const rec: any = qs.recommendationTrend?.trend?.[0];

const pct = (x: number | null | undefined) => (x == null ? "–" : fmtPct(x * 100, false));
const num = (x: number | null | undefined, dp = 2) => (x == null ? "–" : fmtNum(x, dp));
const big = (x: number | null | undefined) => (x == null ? "–" : fmtBig(x));

const yr = trend.find((t: { period?: string }) => t.period === "0y");
const nextYr = trend.find((t: { period?: string }) => t.period === "+1y");

const lines = [
  `# ${symbol} — ${p.longName ?? p.shortName ?? ""}`,
  ``,
  `${ap.sector ?? "?"} · ${ap.industry ?? "?"} · ${ap.country ?? "?"} · ${num(ap.fullTimeEmployees, 0)} employees`,
  `Price ${num(p.regularMarketPrice)} ${p.currency ?? ""} (${pct((p.regularMarketChangePercent as number) ?? null)} today) · Mkt cap ${big(p.marketCap)}`,
  ``,
  `## Valuation`,
  `| metric | value |`,
  `|---|---|`,
  `| Trailing P/E | ${num(sd.trailingPE, 1)} |`,
  `| Forward P/E | ${num(sd.forwardPE ?? ks.forwardPE, 1)} |`,
  `| PEG | ${num(ks.pegRatio, 2)} |`,
  `| Price/Sales | ${num(sd.priceToSalesTrailing12Months, 2)} |`,
  `| Price/Book | ${num(ks.priceToBook, 2)} |`,
  `| EV/EBITDA | ${num(ks.enterpriseToEbitda, 1)} |`,
  `| Dividend yield | ${pct(sd.dividendYield)} |`,
  ``,
  `## Profitability & health`,
  `| metric | value |`,
  `|---|---|`,
  `| Gross margin | ${pct(fd.grossMargins)} |`,
  `| Operating margin | ${pct(fd.operatingMargins)} |`,
  `| Profit margin | ${pct(fd.profitMargins)} |`,
  `| ROE | ${pct(fd.returnOnEquity)} |`,
  `| ROA | ${pct(fd.returnOnAssets)} |`,
  `| Revenue (ttm) | ${big(fd.totalRevenue)} |`,
  `| EBITDA | ${big(fd.ebitda)} |`,
  `| Free cash flow | ${big(fd.freeCashflow)} |`,
  `| Total cash | ${big(fd.totalCash)} |`,
  `| Total debt | ${big(fd.totalDebt)} |`,
  `| Debt/Equity | ${num(fd.debtToEquity, 1)} |`,
  `| Current ratio | ${num(fd.currentRatio, 2)} |`,
  ``,
  `## Growth`,
  `| metric | value |`,
  `|---|---|`,
  `| Revenue growth (yoy) | ${pct(fd.revenueGrowth)} |`,
  `| Earnings growth (yoy) | ${pct(fd.earningsGrowth)} |`,
  `| Est. revenue growth (this yr) | ${pct(yr?.revenueEstimate?.growth ?? null)} |`,
  `| Est. revenue growth (next yr) | ${pct(nextYr?.revenueEstimate?.growth ?? null)} |`,
  `| Est. EPS (this yr) | ${num(yr?.earningsEstimate?.avg ?? null)} |`,
  `| Est. EPS (next yr) | ${num(nextYr?.earningsEstimate?.avg ?? null)} |`,
  ``,
  `## Street view`,
  `| metric | value |`,
  `|---|---|`,
  `| Recommendation | ${fd.recommendationKey ?? "–"} (${num(fd.recommendationMean, 1)}) |`,
  `| Analysts | ${num(fd.numberOfAnalystOpinions, 0)} |`,
  `| Target low/mean/high | ${num(fd.targetLowPrice)} / ${num(fd.targetMeanPrice)} / ${num(fd.targetHighPrice)} |`,
  `| Upside to mean target | ${fd.targetMeanPrice && p.regularMarketPrice ? fmtPct((fd.targetMeanPrice / p.regularMarketPrice - 1) * 100) : "–"} |`,
  rec ? `| Ratings (strongBuy/buy/hold/sell/strongSell) | ${rec.strongBuy}/${rec.buy}/${rec.hold}/${rec.sell}/${rec.strongSell} |` : "",
  ``,
  `## Business`,
  `${(ap.longBusinessSummary ?? "").slice(0, 600)}`,
];

console.log(lines.filter((l) => l !== "").join("\n"));
