/**
 * Comparables: peer multiples table, ranked. Peers come from Yahoo's
 * similar-symbols API unless passed explicitly.
 * Usage: npx tsx scripts/comps.ts SYMBOL [PEER1 PEER2 ...]
 */
import { yf } from "../src/lib/yahoo.js";
import { fmtBig, fmtNum, fmtPct } from "../src/lib/format.js";

const symbol = process.argv[2]?.toUpperCase();
if (!symbol) {
  console.error("usage: tsx scripts/comps.ts SYMBOL [PEER1 PEER2 ...]");
  process.exit(1);
}
let peers = process.argv.slice(3).map((s) => s.toUpperCase());
if (!peers.length) {
  const rec = (await yf.recommendationsBySymbol(symbol)) as unknown as {
    recommendedSymbols?: { symbol: string }[];
  };
  peers = (rec.recommendedSymbols ?? []).map((r) => r.symbol).slice(0, 5);
}
const universe = [symbol, ...peers];

/* eslint-disable @typescript-eslint/no-explicit-any */
const rows = await Promise.all(
  universe.map(async (s) => {
    try {
      const qs: any = await yf.quoteSummary(s, {
        modules: ["price", "summaryDetail", "financialData", "defaultKeyStatistics"],
      });
      return {
        symbol: s,
        name: qs.price?.shortName ?? "",
        mcap: qs.price?.marketCap ?? null,
        pe: qs.summaryDetail?.trailingPE ?? null,
        fwdPe: qs.summaryDetail?.forwardPE ?? qs.defaultKeyStatistics?.forwardPE ?? null,
        ps: qs.summaryDetail?.priceToSalesTrailing12Months ?? null,
        evEbitda: qs.defaultKeyStatistics?.enterpriseToEbitda ?? null,
        margin: qs.financialData?.profitMargins ?? null,
        growth: qs.financialData?.revenueGrowth ?? null,
      };
    } catch {
      return null;
    }
  }),
);
const ok = rows.filter((r): r is NonNullable<typeof r> => r != null);

console.log(`# ${symbol} vs peers\n`);
console.log(`| symbol | mkt cap | P/E | fwd P/E | P/S | EV/EBITDA | net margin | rev growth |`);
console.log(`|---|---|---|---|---|---|---|---|`);
for (const r of ok) {
  const mark = r.symbol === symbol ? `**${r.symbol}**` : r.symbol;
  console.log(
    `| ${mark} | ${fmtBig(r.mcap)} | ${r.pe != null ? fmtNum(r.pe, 1) : "–"} | ${r.fwdPe != null ? fmtNum(r.fwdPe, 1) : "–"} | ${r.ps != null ? fmtNum(r.ps, 1) : "–"} | ${r.evEbitda != null ? fmtNum(r.evEbitda, 1) : "–"} | ${r.margin != null ? fmtPct(r.margin * 100, false) : "–"} | ${r.growth != null ? fmtPct(r.growth * 100) : "–"} |`,
  );
}

const med = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
};
const peerRows = ok.filter((r) => r.symbol !== symbol);
const target = ok.find((r) => r.symbol === symbol);
const medPe = med(peerRows.map((r) => r.fwdPe));
if (target?.fwdPe != null && medPe != null) {
  console.log(
    `\nPeer median forward P/E is ${fmtNum(medPe, 1)}; ${symbol} trades at ${fmtNum(target.fwdPe, 1)} — a ${fmtPct((target.fwdPe / medPe - 1) * 100)} ${target.fwdPe > medPe ? "premium" : "discount"}.`,
  );
}
console.log(
  `\n_Yahoo's peer list is similarity-based, not a strict sector screen — swap in your own peers as extra args when it misses. Multiples without growth/margin context mislead; read the columns together._`,
);
