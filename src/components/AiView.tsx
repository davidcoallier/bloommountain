import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import { useStore } from "../store.js";
import { loadAiConfig, PROVIDER_LABELS } from "../lib/aiconfig.js";
import { truncate } from "../lib/format.js";
import { theme } from "../theme.js";

const SPIN = ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"];

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + " " + d.toTimeString().slice(0, 5);
}

/** AI desk: current conversation (chat) or the saved-analyses browser (list). */
export function AiView() {
  const convo = useStore((s) => s.aiCurrent);
  const mode = useStore((s) => s.aiMode);
  const convos = useStore((s) => s.aiConvos);
  const histIndex = useStore((s) => s.aiHistIndex);
  const exIndex = useStore((s) => s.aiExIndex);
  const running = useStore((s) => s.aiRunning);

  const [engine] = useState(() => {
    const cfg = loadAiConfig();
    return cfg.provider === "claude-code" ? PROVIDER_LABELS[cfg.provider] : `${PROVIDER_LABELS[cfg.provider]} · ${cfg.model ?? "?"}`;
  });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [running]);
  const elapsed = Math.floor((tick * 250) / 1000);

  if (mode === "list") {
    return (
      <Box flexDirection="column" flexGrow={1} borderStyle="double" borderColor={theme.amber} paddingX={2} paddingY={1}>
        <Box justifyContent="space-between">
          <Text bold color={theme.amber}>
            ◆ CLAUDE — saved analyses
          </Text>
          <Text color={theme.dim}>↑↓ pick · ⏎ open · esc back</Text>
        </Box>
        <Text> </Text>
        {convos.length === 0 && <Text color={theme.dim}>Nothing yet — ask a question at the prompt (3+ words) to start one.</Text>}
        {convos.slice(0, 20).map((c, i) => {
          const sel = i === histIndex;
          return (
            <Box key={c.id} height={1} overflow="hidden">
              <Text color={theme.dim}>{fmtWhen(c.startedAt)}  </Text>
              <Text color={sel ? theme.amber : theme.text} inverse={sel} bold={sel}>
                {truncate(c.exchanges[0]?.q ?? "", 90)}
              </Text>
              <Text color={theme.dim}>  {c.exchanges.length} exchange{c.exchanges.length === 1 ? "" : "s"}</Text>
            </Box>
          );
        })}
      </Box>
    );
  }

  const exchanges = convo?.exchanges ?? [];
  const ex = exchanges[Math.min(exIndex, exchanges.length - 1)];

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="double" borderColor={theme.amber} paddingX={2} paddingY={1}>
      <Box justifyContent="space-between">
        <Text bold color={theme.amber}>
          ◆ CLAUDE
          {convo ? (
            <Text color={theme.dim}>
              {"  "}
              {fmtWhen(convo.startedAt)}
              {exchanges.length > 1 ? ` · ${Math.min(exIndex, exchanges.length - 1) + 1}/${exchanges.length} ←→` : ""}
            </Text>
          ) : null}
        </Text>
        <Text color={theme.dim}>{engine} · {running ? "esc cancel" : "HIST ⏎ saved · esc back"}</Text>
      </Box>
      <Text> </Text>
      {!convo && <Text color={theme.dim}>Ask a question in the prompt below.</Text>}
      {ex && (
        <>
          <Box>
            <Text color={theme.amber} bold>
              ❯{" "}
            </Text>
            <Text color={theme.text}>{ex.q}</Text>
          </Box>
          <Text> </Text>
          {running && exIndex === exchanges.length - 1 ? (
            <Text color={theme.amber}>
              {SPIN[tick % SPIN.length]} running the analysis skills… {elapsed}s
              <Text color={theme.dim}>  (fetches live data, can take a minute or two)</Text>
            </Text>
          ) : (
            <Box width={100} flexDirection="column">
              <Text color={ex.failed ? theme.down : theme.text} wrap="wrap">
                {ex.a}
              </Text>
            </Box>
          )}
        </>
      )}
      <Box flexGrow={1} />
      <Text color={theme.dim}>type a follow-up in the prompt below — same conversation, full context</Text>
    </Box>
  );
}
