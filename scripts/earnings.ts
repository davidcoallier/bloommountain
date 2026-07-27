/**
 * Earnings scout: next report date, beat/miss history, and the options-implied
 * move into the print. Usage: npx tsx scripts/earnings.ts SYMBOL
 */
import { yf } from "../src/lib/yahoo.js";
import { fmtPct, fmtPrice } from "../src/lib/format.js";
import { chainSummary } from "./lib/opts.js";

const symbol = process.argv[2]?.toUpperCase();
if (!symbol) {
  console.error("usage: tsx scripts/earnings.ts SYMBOL");
  process.exit(1);
}

const qs = (await yf.quoteSummary(symbol, {
  modules: ["calendarEvents", "earningsHistory", "earningsTrend", "price"],
})) as Record<string, unknown> as {
  calendarEvents?: { earnings?: { earningsDate?: Date[]; earningsAverage?: number } };
  earningsHistory?: { history?: { epsActual?: number; epsEstimate?: number; surprisePercent?: number; quarter?: Date }[] };
  earningsTrend?: { trend?: { period?: string; earningsEstimate?: { avg?: number; numberOfAnalysts?: number } }[] };
  price?: { regularMarketPrice?: number; shortName?: string };
};

const next = qs.calendarEvents?.earnings?.earningsDate?.[0] ?? null;
const days = next ? Math.ceil((next.getTime() - Date.now()) / 864e5) : null;
const hist = qs.earningsHistory?.history ?? [];
const currentQ = qs.earningsTrend?.trend?.find((t) => t.period === "0q");

console.log(`# ${symbol} — earnings scout${qs.price?.shortName ? ` (${qs.price.shortName})` : ""}\n`);
console.log(
  next
    ? `Next report: **${next.toISOString().slice(0, 10)}** (${days} day${days === 1 ? "" : "s"} out)${
        currentQ?.earningsEstimate?.avg != null
          ? ` · consensus EPS ${currentQ.earningsEstimate.avg} (${currentQ.earningsEstimate.numberOfAnalysts} analysts)`
          : ""
      }`
    : `No scheduled earnings date found.`,
);

if (hist.length) {
  console.log(`\n## Last ${hist.length} quarters\n`);
  console.log(`| quarter | est | actual | surprise |`);
  console.log(`|---|---|---|---|`);
  for (const h of [...hist].reverse()) {
    console.log(
      `| ${h.quarter?.toISOString().slice(0, 10) ?? "?"} | ${h.epsEstimate ?? "?"} | ${h.epsActual ?? "?"} | ${
        h.surprisePercent != null ? fmtPct(h.surprisePercent * 100) : "?"
      } |`,
    );
  }
  const beats = hist.filter((h) => (h.surprisePercent ?? 0) > 0).length;
  console.log(`\nBeat ${beats}/${hist.length} of the last quarters.`);
}

if (next) {
  try {
    const chain = await chainSummary(symbol, next);
    console.log(`\n## Options-implied move (expiry ${chain.expiry.toISOString().slice(0, 10)})\n`);
    console.log(
      `Spot ${fmtPrice(chain.spot)} · ATM straddle implies **±${
        chain.impliedMovePct != null ? (chain.impliedMovePct * 100).toFixed(1) : "?"
      }%** by that expiry · ATM IV ${chain.atmIV != null ? (chain.atmIV * 100).toFixed(0) + "%" : "?"} · put/call volume ${
        chain.putCallVolume?.toFixed(2) ?? "?"
      }`,
    );
  } catch (err) {
    console.log(`\n(implied move unavailable: ${err instanceof Error ? err.message : err})`);
  }
}

console.log(
  `\n_Implied move is the straddle price by the post-earnings expiry — it includes any non-earnings drift to that date. Beat history says nothing about the price reaction._`,
);
