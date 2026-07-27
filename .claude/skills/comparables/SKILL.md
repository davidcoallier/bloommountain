---
name: comparables
description: Peer comps table — multiples (P/E, forward P/E, P/S, EV/EBITDA), margins and growth for a symbol against its peer group, with premium/discount to the peer median. Use for "is X expensive vs peers", "who's the cheapest in the sector", relative-value questions.
---

# Comparables

```bash
npx tsx scripts/comps.ts SYMBOL                 # Yahoo's similar-symbols peer set
npx tsx scripts/comps.ts SYMBOL MSFT GOOG AMZN  # your own peer set
```

1. Never read a multiple column alone — a premium with double the growth and margin is cheap. Walk the columns together and say which premium is earned.
2. Yahoo's peer list is similarity-based and sometimes wrong; if it looks off, rebuild with explicit peers before concluding anything.
3. The median line is the headline ("34.5x vs peer median 21.7x, a 59% premium") — then explain it or call it unjustified, one or the other.
4. For a deep single-name view after the comp, hand off to `financial-analyst`.
