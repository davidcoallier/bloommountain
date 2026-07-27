import { Box, Text } from "ink";
import type { NewsItem } from "../lib/yahoo.js";
import { truncate } from "../lib/format.js";
import { theme } from "../theme.js";

/** Full-screen news reader: complete headlines, selection, open-in-browser. */
export function NewsFull({
  symbol,
  items,
  index,
  loading,
}: {
  symbol: string;
  items: NewsItem[];
  index: number;
  loading: boolean;
}) {
  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="double"
      borderColor={theme.amber}
      paddingX={2}
      paddingY={1}
    >
      <Box justifyContent="space-between">
        <Text bold color={theme.amber}>
          NEWS — {symbol}
        </Text>
        <Text color={theme.dim}>↑↓ select · ⏎/o open in browser · esc back</Text>
      </Box>
      <Text> </Text>
      {loading && items.length === 0 && <Text color={theme.dim}>loading…</Text>}
      {items.map((n, i) => {
        const sel = i === index;
        return (
          <Box key={i} flexDirection="column" marginBottom={sel ? 0 : 0}>
            <Box>
              <Text color={sel ? theme.amber : theme.dim} bold={sel}>
                {sel ? "▶ " : "  "}
              </Text>
              <Text color={sel ? theme.amber : theme.text} bold={sel} wrap="wrap">
                {n.title}
              </Text>
            </Box>
            <Text color={theme.dim}>
              {"    "}
              {n.publisher}
              {n.published ? ` · ${n.published.toISOString().slice(0, 16).replace("T", " ")}` : ""}
              {sel && n.link ? ` · ${truncate(n.link, 70)}` : ""}
            </Text>
          </Box>
        );
      })}
      {!loading && items.length === 0 && <Text color={theme.dim}>no stories for {symbol}</Text>}
    </Box>
  );
}
