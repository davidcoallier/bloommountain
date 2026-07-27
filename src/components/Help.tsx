import { Box, Text } from "ink";
import { theme } from "../theme.js";

const ROWS: [string, string][] = [
  ["AAPL ⏎", "load any Yahoo symbol (0700.HK, EURUSD=X, CL=F, BTC-USD…)"],
  ["ryanair…", "type a name — autocomplete appears; ↑↓ pick, ⏎ open"],
  ["why is XOM moving? ⏎", "ask Claude — runs the analysis skills on live data (or ASK …)"],
  ["HIST ⏎ / AI ⏎", "saved analyses browser / reopen the current conversation"],
  ["BUY 10 NVDA ⏎", "paper-trade: bare number = shares, $ = coins (BUY $5000 X) · SELL ALL X · PORT ⏎"],
  ["ADD tesla / RM TS…", "watchlist with autocomplete (persisted)"],
  ["1D 5D 1M 6M 1Y 5Y", "chart period (or keys 1–6 with empty prompt)"],
  ["↑ / ↓  then ⏎", "navigate watchlist, load selection"],
  ["← / →", "switch panel focus: watchlist ⇄ news"],
  ["NEWS ⏎", "full-screen news reader (⏎/o opens story, esc back)"],
  ["FUT ⏎", "futures desk — board, prediction-market odds, multi-source wire"],
  ["STRAT ⏎", "strategy picker — overlay SMA/EMA cross, Bollinger, Donchian"],
  ["SMA EMA BB DON ⏎", "toggle a strategy straight from the prompt"],
  ["tab", "cycle chart period"],
  ["esc", "clear prompt"],
  ["LOGIN / LOGOUT ⏎", "connect or disconnect your Claude account (AI features)"],
  ["?", "toggle this help"],
  ["QUIT ⏎ / ctrl+c", "exit"],
];

export function Help() {
  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="double"
      borderColor={theme.amber}
      paddingX={2}
      paddingY={1}
    >
      <Text bold color={theme.amber}>
        BLOOMMOUNTAIN — COMMANDS
      </Text>
      <Text> </Text>
      {ROWS.map(([k, v]) => (
        <Box key={k}>
          <Box width={24}>
            <Text color={theme.amber}>{k}</Text>
          </Box>
          <Text color={theme.text}>{v}</Text>
        </Box>
      ))}
      <Text> </Text>
      <Text color={theme.dim}>data: Yahoo Finance public endpoints · quotes delayed per exchange rules</Text>
      <Text color={theme.dim}>press any key to close</Text>
    </Box>
  );
}
