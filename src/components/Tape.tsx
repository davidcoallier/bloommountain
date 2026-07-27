import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import { fetchQuotes } from "../lib/yahoo.js";
import { usePoll } from "../hooks/usePoll.js";
import { useTerminalSize } from "../hooks/useTerminalSize.js";
import { fmtPct, fmtPrice } from "../lib/format.js";
import { deltaColor, theme } from "../theme.js";

const TAPE: [string, string][] = [
  ["^GSPC", "SPX"],
  ["^IXIC", "NDX"],
  ["^FTSE", "FTSE"],
  ["^STOXX50E", "SX5E"],
  ["EURUSD=X", "EURUSD"],
  ["BTC-USD", "BTC"],
  ["CL=F", "WTI"],
  ["GC=F", "GOLD"],
];

const SCROLL_MS = 150;
// header row: paddingX(2) + brand "◆ BLOOMMOUNTAIN  "(17) + clock(8) + breathing room
const RESERVED = 30;

interface Cell {
  c: string;
  color: string;
}

/** Rolling ticker: the tape loops right-to-left through a fixed window. */
export function Tape() {
  const { data } = usePoll(() => fetchQuotes(TAPE.map(([s]) => s)), [], 20_000);
  const { cols } = useTerminalSize();
  const [offset, setOffset] = useState(0);

  const cells: Cell[] = [];
  const push = (text: string, color: string) => {
    for (const c of text) cells.push({ c, color });
  };
  if (data) {
    TAPE.forEach(([, label], i) => {
      const q = data[i];
      push(`${label} `, theme.dim);
      push(fmtPrice(q?.price ?? null), theme.text);
      if (q?.pct != null) push(` ${fmtPct(q.pct)}`, deltaColor(q.pct));
      push("   ·   ", theme.dim);
    });
  }

  const hasTape = cells.length > 0;
  useEffect(() => {
    if (!hasTape) return;
    const id = setInterval(() => setOffset((o) => o + 1), SCROLL_MS);
    return () => clearInterval(id);
  }, [hasTape]);

  if (!hasTape) return <Text color={theme.dim}>…</Text>;

  const width = Math.max(20, cols - RESERVED);
  if (cells.length <= width) {
    // tape fits — nothing to scroll
    return (
      <Box height={1} overflow="hidden">
        {runsOf(cells).map((r, i) => (
          <Text key={i} color={r.color}>
            {r.text}
          </Text>
        ))}
      </Box>
    );
  }

  // sliding window over the looped tape
  const window: Cell[] = [];
  for (let i = 0; i < width; i++) window.push(cells[(offset + i) % cells.length]);

  return (
    <Box height={1} overflow="hidden">
      {runsOf(window).map((r, i) => (
        <Text key={i} color={r.color}>
          {r.text}
        </Text>
      ))}
    </Box>
  );
}

function runsOf(cells: Cell[]): { text: string; color: string }[] {
  const runs: { text: string; color: string }[] = [];
  for (const cell of cells) {
    const last = runs[runs.length - 1];
    if (last && last.color === cell.color) last.text += cell.c;
    else runs.push({ text: cell.c, color: cell.color });
  }
  return runs;
}
