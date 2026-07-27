import { Box, Text } from "ink";
import { useStore } from "../store.js";
import { theme } from "../theme.js";

export function CommandBar() {
  const buffer = useStore((s) => s.buffer);
  const status = useStore((s) => s.status);

  return (
    <Box paddingX={1} justifyContent="space-between">
      <Box>
        <Text bold color={theme.amber}>
          ❯{" "}
        </Text>
        <Text color={theme.text}>{buffer}</Text>
        <Text color={theme.amber}>█</Text>
      </Box>
      <Text color={theme.dim}>{status}</Text>
    </Box>
  );
}
