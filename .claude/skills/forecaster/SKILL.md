---
name: forecaster
description: Statistical forecast for a ticker — realized volatility, trend/momentum read, drawdown, Monte Carlo price cone over N days. Use when the user asks "where could X be in a month", "how volatile is X", "what's the downside", or wants scenario ranges rather than a single prediction.
---

# Forecaster

Produce a probabilistic view, never a point prediction. Run the script, then interpret.

## Run

```bash
npx tsx scripts/forecaster.ts SYMBOL                    # 30 trading days, 5000 paths
npx tsx scripts/forecaster.ts SYMBOL --days 63          # ~one quarter
npx tsx scripts/forecaster.ts SYMBOL --paths 20000      # tighter percentiles
```

## How to interpret

1. **Lead with the cone, not the median.** "Roughly 90% of simulated paths land between p5 and p95" is the honest headline. The p50 is noise.
2. **Vol is the real output.** Annualized vol tells the user what kind of asset they're holding: <20% is an index-like ride, 40%+ is single-stock tech, 60%+ is crypto-adjacent.
3. **Cross-check the trend read** (SMA stack + RSI) against the drift: a positive drift with a downtrend stack means the sample average is being carried by old gains — say so.
4. **State the model's blind spots every time**: GBM knows nothing about earnings dates, Fed meetings, or regime change. If earnings fall inside the horizon, flag it (check the news via `market-connector` or the TUI).
5. If the user asks "will it go up": give P(above spot), then immediately reframe — for ~most liquid names it hovers near 50%, and that IS the answer.

Never present the cone as advice. It frames risk; it does not predict.
