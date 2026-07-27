---
name: trade-journal
description: Trade journal — log a thesis at entry, close with the outcome, and review the user's real hit rate, average win/loss, and expectancy. Use when the user opens or closes a position, mentions a trade idea worth recording, or asks "how am I actually doing".
---

# Trade Journal

```bash
npx tsx scripts/journal.ts add --symbol NVDA --side long --thesis "reason"   # entry price auto-filled
npx tsx scripts/journal.ts close --id 3                                       # exit at current price
npx tsx scripts/journal.ts review
```

1. When the user states a trade decision, offer to log it — one line, thesis included. The thesis at entry is the whole point: it makes the review honest later.
2. On review, the numbers that matter are expectancy and avg win vs avg loss — a 40% hit rate with 3:1 wins beats a 70% hit rate that bleeds. Compute the comparison for them.
3. When a closed trade's outcome contradicts its thesis, say so specifically — "right stock, wrong reason" compounds into bad habits if unexamined.
4. Data at ~/.config/bloommountain/journal.json; entries are the user's — never edit or delete without being asked.
