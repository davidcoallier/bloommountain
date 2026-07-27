import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { useStore } from "../store.js";
import { usePoll } from "../hooks/usePoll.js";
import { fetchFuturesBoard } from "../lib/futures.js";
import { fetchPredictions } from "../lib/predictions.js";
import { fetchWire } from "../lib/wire.js";
import { openUrl } from "../lib/open.js";
import { fmtBig, fmtPct, fmtPrice, truncate } from "../lib/format.js";
import { deltaColor, theme } from "../theme.js";

const PRED_ROWS = 6;
const WIRE_ROWS = 12;

function when(d: Date | null): string {
  if (!d) return "";
  const today = d.toDateString() === new Date().toDateString();
  return today
    ? d.toTimeString().slice(0, 5)
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/** Full-screen futures desk: board, prediction markets, multi-source wire. */
export function Futures({ active }: { active: boolean }) {
  const setView = useStore((s) => s.setView);
  const setStatus = useStore((s) => s.setStatus);
  const board = usePoll(fetchFuturesBoard, [], 20_000);
  const preds = usePoll(() => fetchPredictions(PRED_ROWS), [], 60_000);
  const wire = usePoll(() => fetchWire(WIRE_ROWS), [], 300_000);
  const [sel, setSel] = useState(0);
  const items = wire.data ?? [];

  useInput(
    (input, key) => {
      if (key.escape || input === "q") return setView("main");
      if (key.upArrow) return setSel((v) => Math.max(0, v - 1));
      if (key.downArrow) return setSel((v) => Math.min(Math.max(0, items.length - 1), v + 1));
      if (key.return || input === "o") {
        const item = items[sel];
        if (item?.link) {
          openUrl(item.link);
          setStatus("opened in browser");
        }
      }
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
          FUTURES — prediction desk
        </Text>
        <Text color={theme.dim}>↑↓ wire · ⏎/o open story · esc back</Text>
      </Box>
      <Text> </Text>

      {!board.data && <Text color={theme.dim}>loading board…</Text>}
      {board.data?.groups.map((g) => (
        <Box key={g.group} height={1} overflow="hidden">
          <Box width={9} flexShrink={0}>
            <Text bold color={theme.amber}>
              {g.group}
            </Text>
          </Box>
          {g.entries.map((e) => (
            <Box key={e.label} marginRight={2} flexShrink={0}>
              <Text color={theme.dim}>{e.label} </Text>
              <Text color={theme.text}>{fmtPrice(e.quote.price)}</Text>
              {e.quote.pct != null && <Text color={deltaColor(e.quote.pct)}> {fmtPct(e.quote.pct)}</Text>}
            </Box>
          ))}
        </Box>
      ))}
      {board.data?.impliedFedRate != null && (
        <Text color={theme.dim}>
          fed funds futures imply an average rate of{" "}
          <Text color={theme.amber}>{board.data.impliedFedRate.toFixed(2)}%</Text> (100 − ZQ=F)
        </Text>
      )}
      <Text> </Text>

      <Text bold color={theme.amber}>
        PREDICTION MARKETS <Text color={theme.dim}>Polymarket + Kalshi · by 24h volume</Text>
      </Text>
      {!preds.data && <Text color={theme.dim}>{preds.error ? `unavailable: ${truncate(preds.error, 40)}` : "loading…"}</Text>}
      {preds.data?.map((p, i) => (
        <Box key={i} height={1} overflow="hidden">
          <Box width={5} flexShrink={0} justifyContent="flex-end">
            <Text bold color={p.prob >= 0.5 ? theme.up : theme.down}>
              {Math.round(p.prob * 100)}%
            </Text>
          </Box>
          <Text color={theme.text}> {truncate(p.question, 78)}</Text>
          <Text color={theme.dim}>
            {"  "}
            {p.source} · ${fmtBig(p.volume24h)}/24h
          </Text>
        </Box>
      ))}
      <Text> </Text>

      <Text bold color={theme.amber}>
        WIRE <Text color={theme.dim}>OilPrice + CNBC + MarketWatch</Text>
      </Text>
      {!wire.data && <Text color={theme.dim}>{wire.error ? `unavailable: ${truncate(wire.error, 40)}` : "loading…"}</Text>}
      {items.map((w, i) => {
        const isSel = i === sel;
        return (
          <Box key={i} height={1} overflow="hidden">
            <Text color={isSel ? theme.amber : theme.text} inverse={isSel} wrap="truncate-end">
              {truncate(w.title, 88)}
            </Text>
            <Text color={theme.dim}>
              {"  "}
              {w.source} · {when(w.published)}
              {w.tags.length ? ` · ${w.tags.join(",")}` : ""}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
