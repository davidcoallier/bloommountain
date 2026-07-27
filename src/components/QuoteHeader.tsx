import { Box, Text } from "ink";
import type { Quote } from "../lib/yahoo.js";
import { fmtChange, fmtPct, fmtPrice, truncate } from "../lib/format.js";
import { deltaColor, theme } from "../theme.js";

export function QuoteHeader({ symbol, q }: { symbol: string; q: Quote | null }) {
  return (
    <Box paddingX={1} justifyContent="space-between">
      <Box>
        <Text bold color={theme.amber}>
          {symbol}
        </Text>
        {q?.name ? <Text color={theme.dim}>  {truncate(q.name, 34)}</Text> : null}
        {q?.currency ? <Text color={theme.dim}> · {q.currency}</Text> : null}
      </Box>
      <Box>
        <Text bold color={theme.text}>
          {q ? fmtPrice(q.price) : "…"}
        </Text>
        {q?.change != null && (
          <Text bold color={deltaColor(q.change)}>
            {"  "}{fmtChange(q.change)} ({fmtPct(q.pct)})
          </Text>
        )}
      </Box>
    </Box>
  );
}
