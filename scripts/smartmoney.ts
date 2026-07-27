/**
 * Smart money: insider transactions, net insider activity, and top
 * institutional holders with quarter-over-quarter changes.
 * Usage: npx tsx scripts/smartmoney.ts SYMBOL
 */
import { yf } from "../src/lib/yahoo.js";
import { fmtBig, fmtPct } from "../src/lib/format.js";

const symbol = process.argv[2]?.toUpperCase();
if (!symbol) {
  console.error("usage: tsx scripts/smartmoney.ts SYMBOL");
  process.exit(1);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const qs: any = await yf.quoteSummary(symbol, {
  modules: ["insiderTransactions", "netSharePurchaseActivity", "institutionOwnership", "majorHoldersBreakdown", "price"],
});

console.log(`# ${symbol} — smart money${qs.price?.shortName ? ` (${qs.price.shortName})` : ""}\n`);

const net = qs.netSharePurchaseActivity;
if (net) {
  console.log(`## Insider net activity (${net.period ?? "6m"})\n`);
  console.log(
    `${net.buyInfoCount ?? 0} buys (${fmtBig(net.buyInfoShares ?? 0)} shares) vs ${net.sellInfoCount ?? 0} sells (${fmtBig(net.sellInfoShares ?? 0)} shares) — net ${net.netInfoShares >= 0 ? "**buying**" : "**selling**"} ${fmtBig(Math.abs(net.netInfoShares ?? 0))} shares (${fmtPct((net.netPercentInsiderShares ?? 0) * 100)} of insider holdings)`,
  );
}

const txs: any[] = qs.insiderTransactions?.transactions ?? [];
if (txs.length) {
  console.log(`\n## Recent insider transactions\n`);
  console.log(`| date | who | role | action | value |`);
  console.log(`|---|---|---|---|---|`);
  for (const t of txs.slice(0, 10)) {
    console.log(
      `| ${t.startDate ? new Date(t.startDate).toISOString().slice(0, 10) : "?"} | ${t.filerName ?? "?"} | ${t.filerRelation ?? "?"} | ${t.transactionText || "(grant/transfer)"} | ${t.value ? "$" + fmtBig(t.value) : "–"} |`,
    );
  }
}

const mh = qs.majorHoldersBreakdown;
if (mh) {
  console.log(`\n## Ownership\n`);
  console.log(
    `Insiders ${fmtPct((mh.insidersPercentHeld ?? 0) * 100, false)} · institutions ${fmtPct((mh.institutionsPercentHeld ?? 0) * 100, false)} (${mh.institutionsCount?.toLocaleString() ?? "?"} holders)`,
  );
}

const inst: any[] = qs.institutionOwnership?.ownershipList ?? [];
if (inst.length) {
  console.log(`\n## Top institutions (latest 13F quarter)\n`);
  console.log(`| institution | % held | value | Q/Q change |`);
  console.log(`|---|---|---|---|`);
  for (const o of inst.slice(0, 8)) {
    console.log(
      `| ${o.organization} | ${fmtPct((o.pctHeld ?? 0) * 100, false)} | $${fmtBig(o.value ?? 0)} | ${o.pctChange != null ? fmtPct(o.pctChange * 100) : "–"} |`,
    );
  }
}

console.log(
  `\n_Insider sales are often scheduled (10b5-1) and mean little; clustered open-market **buys** are the informative signal. 13F data lags by up to 45 days._`,
);
