import { Box, Text } from "ink";
import { useStore } from "../store.js";
import { fetchCandles, type Candle } from "../lib/yahoo.js";
import { usePoll } from "../hooks/usePoll.js";
import { fmtPrice, resample } from "../lib/format.js";
import { PERIOD_KEYS } from "../lib/periods.js";
import { STRATEGIES, padWarmup, type Signal, type Strategy, type StrategyResult } from "../lib/strategies.js";
import { BrailleCanvas } from "../lib/braille.js";
import { deltaColor, theme } from "../theme.js";

const UP_ANSI = "\x1b[32m";
const DOWN_ANSI = "\x1b[31m";
const BUY_ANSI = "\x1b[92m";
const SELL_ANSI = "\x1b[91m";
const MAX_MARKERS = 10;

function fmtSignalDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/**
 * Smooth braille chart: price + overlays as sub-cell dot lines, recent
 * signals as ▲/▼ markers. Returns one string per row (without axis labels).
 */
function renderBraille(
  data: Candle[],
  results: { st: Strategy; r: StrategyResult }[],
  up: boolean,
  cols: number,
  rows: number,
): { lines: string[]; min: number; max: number } {
  const canvas = new BrailleCanvas(cols, rows);
  const pw = canvas.pixelWidth;
  const ph = canvas.pixelHeight;

  const closes = data.map((c) => c.close);
  const seriesList: { pts: number[]; ansi: string; dots: boolean }[] = [];
  for (const { r } of results) {
    for (const o of r.overlays) {
      const padded = padWarmup(o.values);
      if (padded.some((v) => isNaN(v))) continue; // never defined in window
      seriesList.push({ pts: resample(padded, pw), ansi: o.ansi, dots: o.style === "dots" });
    }
  }
  // price drawn last so it wins overlapping cells
  seriesList.push({ pts: resample(closes, pw), ansi: up ? UP_ANSI : DOWN_ANSI, dots: false });

  let min = Infinity;
  let max = -Infinity;
  for (const s of seriesList)
    for (const v of s.pts) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  const range = max - min || 1;
  const toY = (v: number) => Math.round(((max - v) / range) * (ph - 1));

  for (const s of seriesList) {
    const n = s.pts.length;
    for (let i = 0; i < n; i++) {
      const x = n > 1 ? Math.round((i * (pw - 1)) / (n - 1)) : 0;
      const y = toY(s.pts[i]);
      if (s.dots) {
        if (i % 3 === 0) canvas.setPixel(x, y, s.ansi); // dotted trail
      } else if (i > 0) {
        const px = Math.round(((i - 1) * (pw - 1)) / (n - 1));
        canvas.line(px, toY(s.pts[i - 1]), x, y, s.ansi);
      } else {
        canvas.setPixel(x, y, s.ansi);
      }
    }
  }

  // recent signals as on-chart markers at the closing price of their bar
  const markers = results
    .flatMap(({ r }) => r.signals)
    .sort((a, b) => b.index - a.index)
    .slice(0, MAX_MARKERS);
  for (const sig of markers) {
    const x = data.length > 1 ? Math.round((sig.index * (pw - 1)) / (data.length - 1)) : 0;
    const y = toY(data[sig.index].close);
    canvas.setMarker(x >> 1, y >> 2, sig.side === "buy" ? "▲" : "▼", sig.side === "buy" ? BUY_ANSI : SELL_ANSI);
  }

  return { lines: canvas.render(), min, max };
}

export function Chart({ width, height }: { width: number; height: number }) {
  const symbol = useStore((s) => s.symbol);
  const period = useStore((s) => s.period);
  const activeKeys = useStore((s) => s.strategies);

  const { data, error, loading } = usePoll(() => fetchCandles(symbol, period), [symbol, period], 60_000);

  const active: Strategy[] = STRATEGIES.filter((st) => activeKeys.includes(st.key));
  const results = data && data.length > 1 ? active.map((st) => ({ st, r: st.compute(data) })) : [];

  // border(2) + paddingX(2) + y-axis labels + " ┤" (~11); legend rows when strategies active
  const plotWidth = Math.max(20, width - 15);
  const plotHeight = Math.max(6, height - 5 - (active.length ? 2 : 0));

  let body: string | null = null;
  let up = true;
  if (data && data.length > 1) {
    const closes = data.map((c) => c.close);
    up = closes[closes.length - 1] >= closes[0];
    const { lines, min, max } = renderBraille(data, results, up, plotWidth, plotHeight);
    const range = max - min || 1;
    body = lines
      .map((line, row) => {
        // label at the vertical center of this row's 4-pixel band
        const v = max - ((row * 4 + 1.5) / (plotHeight * 4 - 1)) * range;
        return `${fmtPrice(v).padStart(9)} ┤${line}`;
      })
      .join("\n");
  }

  const first = data?.[0];
  const last = data?.[data.length - 1];
  const chg = first && last ? ((last.close - first.close) / first.close) * 100 : null;
  const hi = data?.length ? Math.max(...data.map((c) => c.high)) : null;
  const lo = data?.length ? Math.min(...data.map((c) => c.low)) : null;

  // most recent signals across active strategies
  const signals: (Signal & { when: string })[] = results
    .flatMap(({ r }) => r.signals)
    .sort((a, b) => b.index - a.index)
    .slice(0, 3)
    .map((sig) => ({ ...sig, when: data ? fmtSignalDate(data[sig.index].date) : "" }));

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor={theme.border} paddingX={1}>
      <Box justifyContent="space-between">
        <Box>
          {PERIOD_KEYS.map((k, i) => (
            <Text key={k} color={k === period ? theme.amber : theme.dim} bold={k === period}>
              {i + 1}:{k}{"  "}
            </Text>
          ))}
        </Box>
        {chg != null && hi != null && lo != null && (
          <Text color={theme.dim}>
            {period} <Text color={deltaColor(chg)}>{chg >= 0 ? "+" : ""}{chg.toFixed(2)}%</Text>
            {"  H "}{fmtPrice(hi)}{"  L "}{fmtPrice(lo)}
          </Text>
        )}
      </Box>
      {active.length > 0 && (
        <Box height={1} overflow="hidden" justifyContent="space-between">
          <Box>
            {results.map(({ st, r }) => (
              <Box key={st.key} marginRight={2}>
                {r.overlays.length === 0 && !r.note ? (
                  <Text color={theme.amber}>◇{st.key} </Text>
                ) : null}
                {r.overlays.map((o) => (
                  <Text key={o.name} color={o.ink}>
                    ─{o.name}{" "}
                  </Text>
                ))}
                {r.note ? <Text color={theme.dim}>({st.key}: {r.note})</Text> : null}
              </Box>
            ))}
          </Box>
        </Box>
      )}
      {active.length > 0 && (
        <Box height={1} overflow="hidden">
          {signals.length ? (
            signals.map((sig, i) => (
              <Text key={i} color={sig.side === "buy" ? theme.up : theme.down}>
                {sig.side === "buy" ? "▲" : "▼"} {sig.label} {sig.when}
                {i < signals.length - 1 ? "   " : ""}
              </Text>
            ))
          ) : (
            <Text color={theme.dim}>no signals in window</Text>
          )}
        </Box>
      )}
      {body ? (
        <Text>{body}</Text>
      ) : (
        <Box flexGrow={1} alignItems="center" justifyContent="center">
          <Text color={error ? theme.down : theme.dim}>
            {loading ? `loading ${symbol}…` : error ? `no chart: ${error}` : "no data"}
          </Text>
        </Box>
      )}
    </Box>
  );
}
