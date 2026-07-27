/**
 * Dividend safety: yield vs history, payout ratios, FCF coverage, dates.
 * Usage: npx tsx scripts/dividends.ts SYMBOL
 */
import { yf } from "../src/lib/yahoo.js";
import { fmtBig, fmtNum, fmtPct, fmtPrice } from "../src/lib/format.js";

const symbol = process.argv[2]?.toUpperCase();
if (!symbol) {
  console.error("usage: tsx scripts/dividends.ts SYMBOL");
  process.exit(1);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const qs: any = await yf.quoteSummary(symbol, {
  modules: ["summaryDetail", "defaultKeyStatistics", "financialData", "calendarEvents", "price"],
});
const sd = qs.summaryDetail ?? {};
const fd = qs.financialData ?? {};
const cal = qs.calendarEvents ?? {};

if (!sd.dividendRate && !sd.trailingAnnualDividendRate) {
  console.log(`# ${symbol} — pays no dividend.`);
  process.exit(0);
}

const divPerShare = sd.dividendRate ?? sd.trailingAnnualDividendRate;
const price = qs.price?.regularMarketPrice;
const sharesOut = qs.defaultKeyStatistics?.sharesOutstanding;
const totalDiv = divPerShare && sharesOut ? divPerShare * sharesOut : null;
const fcf = fd.freeCashflow ?? null;
const fcfCover = totalDiv && fcf ? fcf / totalDiv : null;

console.log(`# ${symbol} — dividend safety${qs.price?.shortName ? ` (${qs.price.shortName})` : ""}\n`);
console.log(`| metric | value |`);
console.log(`|---|---|`);
console.log(`| Price | ${fmtPrice(price)} |`);
console.log(`| Dividend / share (fwd) | ${fmtPrice(divPerShare)} |`);
console.log(`| Yield | ${sd.dividendYield != null ? fmtPct(sd.dividendYield * 100, false) : "–"} |`);
console.log(`| 5y average yield | ${sd.fiveYearAvgDividendYield != null ? fmtNum(sd.fiveYearAvgDividendYield, 2) + "%" : "–"} |`);
console.log(`| Payout ratio (earnings) | ${sd.payoutRatio != null ? fmtPct(sd.payoutRatio * 100, false) : "–"} |`);
console.log(`| FCF coverage | ${fcfCover != null ? fmtNum(fcfCover, 1) + "× (FCF " + fmtBig(fcf) + " vs " + fmtBig(totalDiv) + " paid)" : "–"} |`);
console.log(`| Ex-dividend date | ${cal.exDividendDate ? new Date(cal.exDividendDate).toISOString().slice(0, 10) : "–"} |`);
console.log(`| Next payout date | ${cal.dividendDate ? new Date(cal.dividendDate).toISOString().slice(0, 10) : "–"} |`);

const flags: string[] = [];
if (sd.payoutRatio > 0.8) flags.push(`payout ratio ${fmtPct(sd.payoutRatio * 100, false)} — little room for earnings wobble`);
if (fcfCover != null && fcfCover < 1.2) flags.push(`FCF coverage ${fmtNum(fcfCover, 1)}× — dividend eats nearly all free cash`);
if (sd.dividendYield != null && sd.fiveYearAvgDividendYield != null && sd.dividendYield * 100 > sd.fiveYearAvgDividendYield * 1.5)
  flags.push(`yield ${fmtPct(sd.dividendYield * 100, false)} is 1.5× the 5y average — check whether that's a falling price, not a raise`);
console.log(flags.length ? `\n**Flags:** ${flags.join("; ")}.` : `\nNo mechanical red flags.`);
console.log(`\n_High yield is a price, not a gift — the market may be pricing a cut. Cross-check with the analyst skill's balance-sheet view._`);
