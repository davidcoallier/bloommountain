import { Box, Text } from "ink";
import { STRATEGIES } from "../lib/strategies.js";
import { theme } from "../theme.js";

export function StrategyPicker({ active, index }: { active: string[]; index: number }) {
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
          STRATEGIES — overlay on chart
        </Text>
        <Text color={theme.dim}>↑↓ move · space/⏎ toggle · esc done</Text>
      </Box>
      <Text> </Text>
      {STRATEGIES.map((st, i) => {
        const on = active.includes(st.key);
        const sel = i === index;
        return (
          <Box key={st.key}>
            <Text color={on ? theme.up : theme.dim} bold={sel}>
              {sel ? "▶ " : "  "}
              {on ? "[●] " : "[ ] "}
            </Text>
            <Box width={26}>
              <Text color={sel ? theme.amber : theme.text} bold={sel} inverse={sel}>
                {st.label}
              </Text>
            </Box>
            <Text color={theme.dim}>
              {"  "}
              {st.desc} · key: {st.key}
            </Text>
          </Box>
        );
      })}
      <Text> </Text>
      <Text color={theme.dim}>
        Toggle from the prompt too by key: SMA, VWAP, ICH, MACD… ⏎. Active strategies persist across sessions.
      </Text>
      <Text color={theme.dim}>Signals (▲ buy / ▼ sell) show under the chart with dates — last three per view.</Text>
    </Box>
  );
}
