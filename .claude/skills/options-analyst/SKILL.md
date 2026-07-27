---
name: options-analyst
description: Options chain read — implied move, ATM IV, put/call ratios, open-interest walls, unusual volume. Use for "what are options saying about X", "where are the walls", "is anyone positioning in X", implied vs expected move questions.
---

# Options Analyst

```bash
npx tsx scripts/options.ts SYMBOL                 # nearest expiry
npx tsx scripts/options.ts SYMBOL --exp 2026-08-21
```

1. Implied move is the market's own forecast — compare it to realized history (`forecaster` gives the vol) and to what the user expects; the trade is in the gap.
2. P/C volume ~0.7 is structurally normal, not bullish. Only flag deviations from that base, and check OI ratio too (positioning vs day-flow).
3. OI walls pin price into expiry more often than they break — name the strikes.
4. Unusual volume is a lead, never a conclusion: could be spreads, hedges, or rolls. Say so.
5. Weekend/overnight quotes go stale; if bids are zero or IV nulls out, re-run in market hours.
