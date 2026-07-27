import { Box, Text } from "ink";
import type { NewsItem } from "../lib/yahoo.js";
import { truncate } from "../lib/format.js";
import { theme } from "../theme.js";

export function News({
  symbol,
  items,
  loading,
  height,
  focused,
  index,
}: {
  symbol: string;
  items: NewsItem[];
  loading: boolean;
  height: number;
  focused: boolean;
  index: number;
}) {
  const maxItems = Math.max(1, Math.floor((height - 3) / 2));
  const start = Math.max(0, Math.min(index - maxItems + 2, items.length - maxItems));

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="round"
      borderColor={focused ? theme.borderFocus : theme.border}
      paddingX={1}
    >
      <Text bold color={theme.amber}>
        NEWS {symbol}
        {focused ? <Text color={theme.dim}>  ⏎ open · NEWS⏎ full</Text> : null}
      </Text>
      {loading && items.length === 0 && <Text color={theme.dim}>loading…</Text>}
      {items.slice(start, start + maxItems).map((n, i) => {
        const idx = start + i;
        const sel = focused && idx === index;
        return (
          <Box key={idx} flexDirection="column">
            <Text wrap="truncate-end" color={sel ? theme.amber : theme.text} bold={sel} inverse={sel}>
              {truncate(n.title, 36)}
            </Text>
            <Text wrap="truncate-end" color={theme.dim}>
              {truncate(n.publisher, 22)}
              {n.published ? ` · ${n.published.toISOString().slice(5, 16).replace("T", " ")}` : ""}
            </Text>
          </Box>
        );
      })}
      {!loading && items.length === 0 && <Text color={theme.dim}>no stories</Text>}
    </Box>
  );
}
