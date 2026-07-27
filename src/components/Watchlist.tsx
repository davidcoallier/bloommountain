import { Box, Text } from "ink";
import { useStore } from "../store.js";
import { fetchQuotes } from "../lib/yahoo.js";
import { usePoll } from "../hooks/usePoll.js";
import { fmtPct, fmtPrice, truncate } from "../lib/format.js";
import { deltaColor, theme } from "../theme.js";

const WIDTH = 30;

export function Watchlist({ height, focused }: { height: number; focused: boolean }) {
  const watchlist = useStore((s) => s.watchlist);
  const selected = useStore((s) => s.selected);
  const active = useStore((s) => s.symbol);

  const { data } = usePoll(() => fetchQuotes(watchlist), [watchlist.join(",")], 12_000);
  const visible = Math.max(1, height - 3);
  const start = Math.max(0, Math.min(selected - visible + 2, watchlist.length - visible));

  return (
    <Box flexDirection="column" width={WIDTH} flexShrink={0} borderStyle="round" borderColor={focused ? theme.borderFocus : theme.border} paddingX={1}>
      <Text bold color={theme.amber}>
        WATCHLIST
      </Text>
      {watchlist.slice(start, start + visible).map((symbol, i) => {
        const idx = start + i;
        const q = data?.[idx];
        const isSel = idx === selected;
        const isActive = symbol === active;
        return (
          <Box key={symbol} height={1} overflow="hidden" justifyContent="space-between">
            <Text
              color={isActive ? theme.amber : isSel ? theme.text : theme.dim}
              inverse={isSel}
              bold={isActive}
            >
              {truncate(symbol, 9).padEnd(9)}
            </Text>
            <Text color={theme.text}>{q ? fmtPrice(q.price).padStart(9) : "…".padStart(9)}</Text>
            <Text color={deltaColor(q?.pct)}>{q ? fmtPct(q.pct).padStart(8) : "".padStart(8)}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
