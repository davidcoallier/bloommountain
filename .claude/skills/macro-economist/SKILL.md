---
name: macro-economist
description: Macro dashboard — US yield curve and 10Y−3M spread, implied fed funds rate, dollar/gold/oil/VIX tape, macro news wire. Use for "what's the macro picture", "is the curve inverted", "what's the market pricing for rates", regime questions behind any equity view.
---

# Macro Economist

```bash
npx tsx scripts/macro.ts
```

1. Curve shape is the regime: state slope, direction, and what it implies for the user's actual holdings (long-duration tech vs banks vs commodities).
2. Cross-check the implied fed funds rate against prediction-market odds (`futures-desk` skill) — agreement is confirmation, divergence is the story.
3. VIX under 15 = complacency premium is cheap; over 25 = fear is expensive. Tie it to whether hedging is worth it right now.
4. No free 2Y ticker on Yahoo, so the spread here is 10Y−3M — the Fed's own preferred recession indicator anyway. Note the substitution when precision matters.
