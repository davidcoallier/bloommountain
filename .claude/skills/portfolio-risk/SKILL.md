---
name: portfolio-risk
description: The risk manager — the user's actual positions marked to market with weights, P&L, sector concentration, correlation matrix, portfolio vol, VaR, and beta. Use for "how is my portfolio", "am I too concentrated", "what's my risk", position sizing questions, or before adding any new position.
---

# Portfolio Risk

```bash
npx tsx scripts/portfolio.ts
```

Positions live in `~/.config/bloommountain/portfolio.json` ({symbol, qty, cost} per line). First run writes a template — tell the user to fill in real holdings.

1. Concentration first: correlation clusters mean the user owns one bet several times. "Five positions, all >0.7 correlated" is the most valuable sentence you can say.
2. Translate VaR to money, not percent — "a normal bad day is about €X" lands.
3. Before a new position: what does it do to the correlation matrix and largest-position share? Adding a 0.9-correlated name is sizing up, not diversifying.
4. Effective positions (1/HHI) below ~4 means diversification is cosmetic. Say it plainly.
5. Always repeat the caveat: correlations rise in selloffs; parametric VaR understates tails.
