---
name: market-connector
description: Explain why an asset is moving by mapping it to the macro complex — correlations and beta vs oil, gold, copper, dollar, rates, S&P, crypto, plus the news flow around its most-correlated assets. Use for "why is X moving", "what drives X", "is X an oil/rates/dollar play", or connecting commodities to equities and headlines.
---

# Market Connector

Connects one asset to the rest of the market: which macro assets it trades with, how tightly, and what the news flow around those assets says right now.

## Run

```bash
npx tsx scripts/connector.ts SYMBOL              # 180 days of daily returns
npx tsx scripts/connector.ts SYMBOL --days 90    # recent regime only
```

Output: beta vs S&P 500, ranked correlation table against WTI/Brent/gold/copper/nat gas/dollar index/10Y yield/S&P/BTC/EURUSD, then recent headlines for the symbol and its top-correlated assets.

## How to analyse

1. **Name the regime.** |corr| ≥ 0.6 with a commodity means the equity is currently trading as a proxy for it (e.g. XOM↔Brent). 0.3–0.6 is a real but partial driver. Below 0.25, don't tell a story.
2. **Run two windows when it matters**: `--days 90` vs `--days 365`. A correlation that appears only in the short window is a new regime — that's usually the interesting finding.
3. **Connect the news to the channel.** The script pulls headlines for the correlated assets on purpose: if the stock is 0.7-correlated to crude and the crude headlines are about supply cuts, you have the causal chain. Say it as a chain: "supply news → crude up → SYMBOL up".
4. **Beta context**: beta > 1.3 = levered market play, near 0 = idiosyncratic/defensive, negative = hedge-like in this window.
5. **Always close with the caveat in the output**: correlation ≠ causation, windows are short, regimes flip.

Pairs well with `financial-analyst` (is the proxy cheap?) and `forecaster` (how wide is the cone if the driver moves?).
