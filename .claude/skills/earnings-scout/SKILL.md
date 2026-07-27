---
name: earnings-scout
description: Earnings catalysts — next report date, consensus EPS, beat/miss history, and the options-implied move into the print. Use for "when does X report", "what's expected", "how big will the move be", or any pre-earnings positioning question.
---

# Earnings Scout

```bash
npx tsx scripts/earnings.ts SYMBOL
```

1. Lead with the date and the implied move — that's the tradeable pair. "Reports Wednesday, options price ±4.3%" frames every decision.
2. Beat history is about the *estimate game*, not the stock: serial beaters get pre-raised expectations, so a beat can still sell off. Say this when the streak is 4/4.
3. The implied move includes drift to expiry, not just earnings night — note the DTE gap.
4. For watchlist-wide scans, run the script per symbol; for whether to hold through the print, pair with `portfolio-risk` (position size vs implied move = expected P&L swing).
