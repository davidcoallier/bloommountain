---
name: futures-desk
description: What the futures and prediction markets are pricing in — grouped futures board, implied fed funds rate, Polymarket/Kalshi macro odds, and the commodity news wire. Use for "what's priced into oil/gold/rates", "what are the odds the Fed cuts", "what's happening in futures/commodities", or any question about market-implied probabilities of events.
---

# Futures Desk

Pull the data pack, then read it as a desk would. Never quote odds from memory — always run the script.

## Run

```bash
npx tsx scripts/futures.ts          # markdown data pack
npx tsx scripts/futures.ts --json   # raw payload
```

Sources: Yahoo futures quotes, Polymarket + Kalshi public APIs (keyless), OilPrice/CNBC/MarketWatch RSS. All free; prediction markets are curated to macro/finance events and sorted by 24h volume.

## How to analyse

1. **Prediction-market odds are the headline.** "The market prices an 80% hold at the July FOMC" is a sourced, dated claim — always name the source and the resolution date. Odds are prices, not truths: mention fees/liquidity bias when a market is thin (volume under ~$50k/24h).
2. **Cross-check odds against the futures board.** The implied fed funds rate (100 − ZQ=F) should be consistent with the Fed odds; divergence between them is itself a finding.
3. **Connect the wire to the board.** Big daily move in a contract → find the headlines with the matching tag and state the chain (supply news → crude → energy equities). Pair with the `market-connector` skill when the user asks about a specific stock.
4. **For "what's priced into X"**: give the level, the day move, the most relevant prediction markets, and the two or three headlines driving it. Close with what would change the picture (data releases, meetings, resolution dates).
5. Cross-source disagreement (Polymarket vs Kalshi on the same event) is worth surfacing — it's usually fees or resolution-criteria differences, occasionally a real edge.
