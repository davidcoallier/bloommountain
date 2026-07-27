---
name: backtester
description: Test the terminal's 15 chart strategies against history — trades, win rate, return vs buy & hold, max drawdown, time in market. Use for "does the SMA cross actually work on X", "which strategy fits this symbol", or whenever a strategy signal is about to drive a decision.
---

# Backtester

```bash
npx tsx scripts/backtest.ts SYMBOL --period 5Y      # all 15 strategies
npx tsx scripts/backtest.ts SYMBOL --strategy MACD --period 1Y
```

1. Compare everything to the buy & hold line first — most strategies lose to it on strong trenders, and saying so is the point of this tool.
2. Risk-adjust in prose: a strategy with 70% of the return at 50% of the drawdown and 40% time-in-market can be the better result. Don't rank on raw return alone.
3. Few trades = no statistical weight. Under ~8 trades, present the result as anecdote, not evidence.
4. One symbol, one window = overfit bait. If the user plans to act on it, re-run on 2–3 comparable symbols and a second period before endorsing anything.
5. The engine is long-only, fills on signal close, no costs — real results will be worse. Say it every time.
