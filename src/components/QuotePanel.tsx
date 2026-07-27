import { Box, Text } from "ink";
import type { ReactNode } from "react";
import type { Quote } from "../lib/yahoo.js";
import { fmtBig, fmtNum, fmtPrice, rangeBar, truncate } from "../lib/format.js";
import { theme } from "../theme.js";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box justifyContent="space-between">
      <Text color={theme.dim}>{label}</Text>
      <Text color={theme.text}>{children}</Text>
    </Box>
  );
}

export function QuotePanel({ q, error }: { q: Quote | null; error: string | null }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.border} paddingX={1}>
      <Text bold color={theme.amber}>
        QUOTE
      </Text>
      {!q && (
        <Text color={error ? theme.down : theme.dim}>{error ? truncate(error, 34) : "loading…"}</Text>
      )}
      {q && (
        <>
          <Row label="open">{fmtPrice(q.open)}</Row>
          <Row label="day">
            {fmtPrice(q.dayLow)} ⇄ {fmtPrice(q.dayHigh)}
          </Row>
          {q.yearLow != null && q.yearHigh != null && q.price != null && (
            <>
              <Row label="52w">
                {fmtPrice(q.yearLow)} ⇄ {fmtPrice(q.yearHigh)}
              </Row>
              <Box justifyContent="flex-end">
                <Text color={theme.amber}>{rangeBar(q.yearLow, q.yearHigh, q.price, 24)}</Text>
              </Box>
            </>
          )}
          <Row label="volume">{fmtBig(q.volume)}</Row>
          <Row label="mkt cap">{fmtBig(q.marketCap)}</Row>
          <Row label="p/e">{q.pe != null ? fmtNum(q.pe, 1) : "–"}</Row>
          <Row label="venue">{truncate(q.exchange, 20)}</Row>
          <Row label="state">{q.marketState || "–"}</Row>
        </>
      )}
    </Box>
  );
}
