---
name: smart-money
description: Insider and institutional positioning — recent insider transactions, net insider buying/selling, top 13F holders with quarter-over-quarter changes. Use for "are insiders buying X", "what are institutions doing", "who owns this", conviction checks on a thesis.
---

# Smart Money

```bash
npx tsx scripts/smartmoney.ts SYMBOL
```

1. The only strong signal here is **clustered open-market insider buying** — several insiders, real money, no 10b5-1 pattern. Everything else is weak.
2. Insider sales mean almost nothing (scheduled plans, diversification, taxes). Don't let the user read bearishness into routine sales.
3. 13F changes lag up to 45 days — frame as "as of the last quarter", never as current positioning.
4. Watch for the divergence trade: insiders buying while shorts pile in (`short-squeeze` skill) is one of the better setups this data can show.
