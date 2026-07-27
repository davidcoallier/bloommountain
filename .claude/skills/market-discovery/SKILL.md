---
name: market-discovery
description: Find what's moving and find tickers — trending symbols, day gainers/losers, most actives, and free-text search of Yahoo's universe (stocks, ETFs, FX, futures, crypto). Use when the user asks "what's moving today", "what's hot", "find me exposure to X", or needs a ticker symbol for a company/theme.
---

# Market Discovery

## Run

```bash
npx tsx scripts/discovery.ts --trending      # what retail is looking at right now
npx tsx scripts/discovery.ts --gainers       # top day gainers
npx tsx scripts/discovery.ts --losers        # top day losers
npx tsx scripts/discovery.ts --actives       # highest volume
npx tsx scripts/discovery.ts "uranium"       # search companies/ETFs/themes → symbols + related news
```

## How to use it

1. **"What's moving" questions**: run `--gainers` and `--losers` together; big single-day moves almost always have a story — pick the 2–3 most notable and check the why via `market-connector` news or a search.
2. **Theme/exposure questions** ("how do I get exposure to lithium"): search the theme, present a shortlist split by type (operating company vs ETF), then offer to run `financial-analyst` on the shortlist.
3. **Trending is sentiment, not quality.** Say so — trending lists skew retail and crypto.
4. **Symbol lookup**: search returns the exact Yahoo symbol format (`.L`, `.IR`, `=X`, `=F`, `-USD` suffixes) — hand these to the other skills or add to the TUI watchlist (`ADD SYM` in the app).
5. Screeners are US-listed only; for European names search directly by name.
