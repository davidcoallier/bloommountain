---
name: dividend-safety
description: Dividend sustainability — yield vs 5-year average, payout ratio, free-cash-flow coverage, ex-div and pay dates, mechanical red flags. Use for "is X's dividend safe", income-portfolio questions, "why is the yield so high".
---

# Dividend Safety

```bash
npx tsx scripts/dividends.ts SYMBOL
```

1. Yield well above its own 5-year average usually means the *price* fell — the market is pricing a cut. That's the first thing to check, not the last.
2. FCF coverage beats the earnings payout ratio — earnings are adjustable, cash isn't. Below ~1.2× FCF coverage, the dividend depends on debt or asset sales.
3. Note one-off distortions (Yahoo's FCF is trailing and lumpy) before declaring danger — cross-check with `financial-analyst` balance-sheet data on a flag.
4. Ex-div date matters for timing; remind the user the price drops by the dividend on that date — there's no free lunch buying the day before.
