/**
 * Market discovery: trending tickers, screeners (gainers/losers/actives),
 * and free-text search across Yahoo's universe.
 *
 * Usage:
 *   npx tsx scripts/discovery.ts --trending
 *   npx tsx scripts/discovery.ts --gainers | --losers | --actives
 *   npx tsx scripts/discovery.ts "lithium miners"
 */
import { yf, fetchQuotes } from "../src/lib/yahoo.js";
import { fmtBig, fmtPct, fmtPrice, truncate } from "../src/lib/format.js";

const mode = process.argv[2];
if (!mode) {
  console.error('usage: tsx scripts/discovery.ts [--trending|--gainers|--losers|--actives|"query"]');
  process.exit(1);
}

function quoteTable(rows: { symbol: string; name: string; price: number | null; pct: number | null; marketCap: number | null }[]): string {
  return [
    `| symbol | name | price | change | mkt cap |`,
    `|---|---|---|---|---|`,
    ...rows.map(
      (q) =>
        `| ${q.symbol} | ${truncate(q.name, 32)} | ${fmtPrice(q.price)} | ${fmtPct(q.pct)} | ${fmtBig(q.marketCap)} |`,
    ),
  ].join("\n");
}

const SCREENS: Record<string, string> = {
  "--gainers": "day_gainers",
  "--losers": "day_losers",
  "--actives": "most_actives",
};

if (mode === "--trending") {
  const t = await yf.trendingSymbols("US", { count: 15 });
  const symbols = (t.quotes ?? []).map((q) => q.symbol);
  const quotes = await fetchQuotes(symbols);
  console.log(`# Trending (US)\n\n${quoteTable(quotes)}`);
} else if (SCREENS[mode]) {
  const res = await yf.screener({ scrIds: SCREENS[mode] as never, count: 15 });
  const rows = (res.quotes ?? []).map((q) => {
    const r = q as unknown as Record<string, unknown>;
    return {
      symbol: String(r.symbol ?? ""),
      name: String(r.shortName ?? r.longName ?? ""),
      price: (r.regularMarketPrice as number) ?? null,
      pct: (r.regularMarketChangePercent as number) ?? null,
      marketCap: (r.marketCap as number) ?? null,
    };
  });
  console.log(`# Screen: ${SCREENS[mode]}\n\n${quoteTable(rows)}`);
} else {
  const res = await yf.search(mode, { quotesCount: 12, newsCount: 5 });
  const hits = (res.quotes ?? []).filter((q) => "symbol" in q) as {
    symbol: string;
    shortname?: string;
    longname?: string;
    quoteType?: string;
    exchDisp?: string;
  }[];
  console.log(`# Search: "${mode}"\n`);
  console.log(`| symbol | name | type | exchange |`);
  console.log(`|---|---|---|---|`);
  for (const h of hits) {
    console.log(
      `| ${h.symbol} | ${truncate(h.shortname ?? h.longname ?? "", 36)} | ${h.quoteType ?? ""} | ${h.exchDisp ?? ""} |`,
    );
  }
  const news = res.news ?? [];
  if (news.length) {
    console.log(`\n## Related news\n`);
    for (const n of news) console.log(`- ${n.title} (${n.publisher})`);
  }
}
