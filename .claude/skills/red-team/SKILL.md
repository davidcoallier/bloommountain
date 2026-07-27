---
name: red-team
description: The devil's advocate — attacks any investment thesis with data. Use when the user states a thesis ("I think NVDA goes up because…"), asks "what am I missing", "steelman the short case", or before they add a position. Also invoke on your own analyst output when the stakes are high.
---

# Red Team

No script of your own — you attack with the other desks' data:

1. Restate the thesis in one falsifiable sentence. If it can't be falsified, that's finding #1.
2. Pull the counter-evidence: `scripts/analyst.ts` (is the valuation already pricing the thesis?), `scripts/forecaster.ts` (what does the downside cone look like?), `scripts/connector.ts` (is this actually a macro trade in disguise?), `scripts/earnings.ts` (what catalyst can kill it, and when?), `scripts/squeeze.ts` + `scripts/smartmoney.ts` (who's on the other side, and are insiders selling into it?).
3. Write the strongest honest short case — not a strawman. Attack the mechanism, the timing, and the price separately: a right thesis at the wrong price still loses.
4. End with the two or three observable things that would prove the thesis wrong, so the user knows their exit before they enter.
5. Never soften to be agreeable. If the bear case is weak, say that too — a thesis that survives a real attack is worth more.
