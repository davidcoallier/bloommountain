---
name: morning-brief
description: Full market briefing — tape check, watchlist movers, notable gainers/losers, and a deep-dive on the day's most interesting name. Use when the user asks "what's happening in markets", "morning brief", "catch me up", or wants a daily market summary.
---

# Morning Brief

Composes the other bloommountain skills into one briefing. Run the data pulls in parallel where possible.

## Steps

1. **Tape**: quote the majors via a quick script —
   ```bash
   node --input-type=module -e "
   import('./src/lib/yahoo.js').then(async ({fetchQuotes}) => {
     const q = await fetchQuotes(['^GSPC','^IXIC','^FTSE','^STOXX50E','^ISEQ','EURUSD=X','BTC-USD','CL=F','GC=F','^TNX']);
     for (const x of q) console.log(x.symbol, x.price, x.pct?.toFixed(2)+'%');
   })"
   ```
2. **Watchlist movers**: read `~/.config/bloommountain/watchlist.json` (fall back to the defaults in `src/lib/watchlist.ts`), fetch quotes the same way, rank by |%change|.
3. **Market movers**: `npx tsx scripts/discovery.ts --gainers` and `--losers`.
4. **Pick the single most interesting name** (biggest anomalous move in watchlist or screens) and go deep: `scripts/connector.ts` for the why, `scripts/analyst.ts` if it's fundamentals-driven.
5. **Write the brief**, in this order: one-paragraph tape read (risk-on/risk-off, what's leading), watchlist movers with one-line explanations, the deep-dive story as a causal chain, anything on the calendar surfaced by the news items (Fed, earnings).

Keep it under 400 words. Lead with the single most important thing. No filler like "markets were mixed" unless they genuinely were.
