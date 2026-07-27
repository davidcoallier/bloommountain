import { Box, Text } from "ink";
import { useStore } from "../store.js";
import { fmtPrice } from "../lib/format.js";
import { deltaColor, theme } from "../theme.js";

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box>
      <Box width={14}>
        <Text color={theme.dim}>{label}</Text>
      </Box>
      <Text color={color ?? theme.text}>{value}</Text>
    </Box>
  );
}

/** Order ticket: the user confirms every fill, exactly like a real trade. */
export function OrderConfirm() {
  const order = useStore((s) => s.pendingOrder);
  if (!order) return null;
  const buy = order.side === "BUY";

  return (
    <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
      <Box flexDirection="column" borderStyle="double" borderColor={theme.amber} paddingX={3} paddingY={1} width={64}>
        <Box justifyContent="space-between">
          <Text bold color={theme.amber}>
            ◆ CONFIRM ORDER
          </Text>
          <Text color={buy ? theme.up : theme.down} bold>
            {order.side}
          </Text>
        </Box>
        <Text> </Text>
        <Row label="symbol" value={`${order.symbol}${order.name ? `  ${order.name}` : ""}`} />
        <Row
          label="quantity"
          value={`${order.qty} share${order.qty === 1 ? "" : "s"}${order.fractional ? ` (fractional, from ${order.qtySpec})` : ""}`}
        />
        <Row label="last price" value={fmtPrice(order.price)} />
        <Row label={buy ? "order value" : "proceeds"} value={`${fmtPrice(order.value)} coins`} color={theme.amber} />
        {order.estPnl != null && (
          <Row
            label="est. P&L"
            value={`${order.estPnl >= 0 ? "+" : ""}${fmtPrice(order.estPnl)}`}
            color={deltaColor(order.estPnl)}
          />
        )}
        <Row label="cash" value={`${fmtPrice(order.cashBefore)} → ${fmtPrice(order.cashAfter)}`} />
        <Text> </Text>
        <Text color={theme.dim}>
          Casino money — no real order is placed. Fills at the delayed quote, which may differ slightly.
        </Text>
        <Text> </Text>
        <Text>
          <Text color={theme.up} bold>
            ⏎/y confirm
          </Text>
          <Text color={theme.dim}> · </Text>
          <Text color={theme.down} bold>
            esc/n cancel
          </Text>
        </Text>
      </Box>
    </Box>
  );
}
