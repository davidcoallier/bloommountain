import { Box, Text, useInput } from "ink";
import { useStore } from "../store.js";
import { usePoll } from "../hooks/usePoll.js";
import { paperBook, START_CASH } from "../lib/paper.js";
import { fmtBig, fmtPct, fmtPrice } from "../lib/format.js";
import { deltaColor, theme } from "../theme.js";

/** Casino-money portfolio: holdings, returns, and the honest S&P benchmark. */
export function Paper({ active }: { active: boolean }) {
  const setView = useStore((s) => s.setView);
  const version = useStore((s) => s.paperVersion);
  const { data: book, loading } = usePoll(paperBook, [version], 10_000);

  useInput(
    (_input, key) => {
      if (key.escape) return setView("main");
    },
    { isActive: active },
  );

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
          ◆ PAPER TRADING <Text color={theme.dim}>casino money, real quotes</Text>
        </Text>
        <Text color={theme.dim}>BUY $1000 NVDA ⏎ · SELL ALL NVDA ⏎ · esc back</Text>
      </Box>
      <Text> </Text>
      {!book && <Text color={theme.dim}>{loading ? "marking to market…" : "no data"}</Text>}
      {book && (
        <>
          <Box>
            <Text color={theme.text}>
              equity <Text bold color={theme.amber}>{fmtPrice(book.equity)}</Text>
              {"  ·  cash "}{fmtPrice(book.state.cash)}
              {"  ·  sell all now: "}
              <Text bold color={deltaColor(book.unrealized)}>
                {(book.unrealized >= 0 ? "+" : "") + fmtPrice(book.unrealized)}
              </Text>
              {"  ·  return "}
              <Text bold color={deltaColor(book.totalReturn)}>{fmtPct(book.totalReturn * 100)}</Text>
              {"  vs S&P "}
              <Text color={deltaColor(book.benchmarkReturn)}>
                {book.benchmarkReturn != null ? fmtPct(book.benchmarkReturn * 100) : "–"}
              </Text>
              <Text color={theme.dim}>
                {"  since "}{book.state.startedAt.slice(0, 10)}
              </Text>
            </Text>
          </Box>
          <Text> </Text>
          {book.rows.length === 0 && (
            <Text color={theme.dim}>
              No positions. You have {fmtBig(book.state.cash)} coins burning a hole — try{" "}
              <Text color={theme.amber}>BUY $10000 NVDA ⏎</Text>
            </Text>
          )}
          {book.rows.length > 0 && (
            <>
              <Text bold color={theme.amber}>HOLDING</Text>
              <Box>
                <Text color={theme.dim}>
                  {"symbol".padEnd(10)}{"qty".padStart(10)}{"avg".padStart(11)}{"last".padStart(11)}{"value".padStart(12)}{"P&L".padStart(12)}{"P&L%".padStart(9)}{"day".padStart(9)}
                </Text>
              </Box>
              {book.rows.map((r) => (
                <Box key={r.symbol} height={1} overflow="hidden">
                  <Text color={theme.amber}>{r.symbol.padEnd(10)}</Text>
                  <Text color={theme.text}>
                    {String(r.qty).padStart(10)}
                    {fmtPrice(r.avgCost).padStart(11)}
                    {fmtPrice(r.price).padStart(11)}
                    {fmtPrice(r.value).padStart(12)}
                  </Text>
                  <Text color={deltaColor(r.pnl)}>{((r.pnl >= 0 ? "+" : "") + fmtPrice(r.pnl)).padStart(12)}</Text>
                  <Text color={deltaColor(r.pnl)}>{fmtPct(r.pnlPct * 100).padStart(9)}</Text>
                  <Text color={deltaColor(r.dayPct)}>{(r.dayPct != null ? fmtPct(r.dayPct) : "–").padStart(9)}</Text>
                </Box>
              ))}
            </>
          )}
          {book.state.closed.length > 0 && (
            <>
              <Text> </Text>
              <Text bold color={theme.amber}>
                SOLD{" "}
                <Text color={theme.dim}>
                  realized <Text color={deltaColor(book.realized)}>{(book.realized >= 0 ? "+" : "") + fmtPrice(book.realized)}</Text> over{" "}
                  {book.state.closed.length} trade{book.state.closed.length === 1 ? "" : "s"}
                </Text>
              </Text>
              <Box>
                <Text color={theme.dim}>
                  {"date".padEnd(12)}{"symbol".padEnd(10)}{"qty".padStart(10)}{"entry".padStart(11)}{"exit".padStart(11)}{"P&L".padStart(12)}{"P&L%".padStart(9)}
                </Text>
              </Box>
              {[...book.state.closed].reverse().slice(0, 8).map((t, i) => {
                const pct = t.entry ? (t.exit / t.entry - 1) * 100 : 0;
                return (
                  <Box key={i} height={1} overflow="hidden">
                    <Text color={theme.dim}>{t.at.slice(0, 10).padEnd(12)}</Text>
                    <Text color={theme.text}>{t.symbol.padEnd(10)}{String(t.qty).padStart(10)}{fmtPrice(t.entry).padStart(11)}{fmtPrice(t.exit).padStart(11)}</Text>
                    <Text color={deltaColor(t.pnl)}>{((t.pnl >= 0 ? "+" : "") + fmtPrice(t.pnl)).padStart(12)}</Text>
                    <Text color={deltaColor(t.pnl)}>{fmtPct(pct).padStart(9)}</Text>
                  </Box>
                );
              })}
              {book.state.closed.length > 8 && (
                <Text color={theme.dim}>…and {book.state.closed.length - 8} earlier trade{book.state.closed.length - 8 === 1 ? "" : "s"}</Text>
              )}
            </>
          )}
          <Box flexGrow={1} />
          <Text color={theme.dim}>
            BUY 10 X = shares · BUY $500 X = coins · fills at delayed quotes · long-only · PAPER RESET ⏎ starts over
          </Text>
        </>
      )}
    </Box>
  );
}
