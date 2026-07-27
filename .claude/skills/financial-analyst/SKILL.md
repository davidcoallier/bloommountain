---
name: financial-analyst
description: Fundamental analysis of a stock/ETF — valuation, margins, growth, balance sheet, analyst targets. Use when the user asks "is X cheap/expensive", "how healthy is X", "should I look at X", or wants a fundamentals rundown of any ticker.
---

# Financial Analyst

Pull the fundamentals data pack, then analyse it. Never guess numbers — always run the script first.

## Run

```bash
npx tsx scripts/analyst.ts SYMBOL          # markdown data pack
npx tsx scripts/analyst.ts SYMBOL --json   # raw quoteSummary payload if you need more fields
```

Works for any Yahoo symbol (AAPL, RYA.IR, 0700.HK, VUSA.L…). Data is Yahoo Finance public endpoints — trailing twelve months, delayed quotes.

## How to analyse

1. **Valuation in context, not in isolation.** A 40x P/E means nothing without the growth line. Check PEG and estimated next-year revenue growth before calling anything expensive. Compare against 1–2 peers (run the script again for them) when the user is deciding between names.
2. **Quality check**: gross margin trend proxy (gross vs operating gap), ROE, FCF vs net income sanity. Flag ROE inflated by leverage — cross-check Debt/Equity.
3. **Red flags to always call out**: negative FCF with positive earnings, current ratio < 1, debt/equity > 150, dividend yield that looks like a value trap (>6% with falling estimates).
4. **Street view is a sentiment gauge, not a target.** Report upside-to-mean-target but note analyst herding.
5. Finish with a 3-sentence verdict: what the market is pricing in, the bull case, the main risk. No hedging soup — take a view and label it as one.

For a full brief on one name, combine with the `forecaster` (vol/trend) and `market-connector` (macro sensitivity) skills.
