---
name: short-squeeze
description: Short-interest scanner — shares short, % of float, days to cover, month-over-month change, squeeze-setup verdict. Use for "is X heavily shorted", "could X squeeze", "who's betting against this".
---

# Short Squeeze

```bash
npx tsx scripts/squeeze.ts SYMBOL
```

1. Fuel ≠ fire: high short interest needs a catalyst to squeeze — check `earnings-scout` for the next one and say whether there's a date.
2. >20% of float with >5 days to cover is genuinely crowded; under 10% is not a squeeze story no matter what social media says.
3. Shorts are often right — heavily shorted companies are usually shorted for reasons. Run `red-team` on the long case before anyone gets excited.
4. Data is exchange-reported with up to two weeks' lag, and borrow fees aren't free anywhere — position may have changed since the print.
