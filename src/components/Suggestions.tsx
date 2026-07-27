import { Box, Text } from "ink";
import type { SymbolSuggestion } from "../lib/yahoo.js";
import { truncate } from "../lib/format.js";
import { theme } from "../theme.js";

export function Suggestions({ items, index }: { items: SymbolSuggestion[]; index: number }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.borderFocus} paddingX={1}>
      {items.map((s, i) => {
        const sel = i === index;
        return (
          <Box key={s.symbol + i} height={1} overflow="hidden" justifyContent="space-between">
            <Box>
              <Text color={sel ? theme.amber : theme.text} inverse={sel} bold={sel}>
                {s.symbol.padEnd(12)}
              </Text>
              <Text color={sel ? theme.text : theme.dim}> {truncate(s.name, 44)}</Text>
            </Box>
            <Text color={theme.dim}>
              {s.type}
              {s.exchange ? ` · ${s.exchange}` : ""}
            </Text>
          </Box>
        );
      })}
      <Text color={theme.dim}>↑↓ pick · ⏎ select · tab fill · esc cancel</Text>
    </Box>
  );
}
