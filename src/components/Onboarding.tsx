import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { useStore } from "../store.js";
import { detectCredentialSource, runClaudeLogin, storeApiKey, validateCredentials } from "../lib/credentials.js";
import { saveAiConfig, type Provider } from "../lib/aiconfig.js";
import { pingProvider } from "../lib/engine.js";
import { theme } from "../theme.js";

type Mode = "menu" | "login-wait" | "key" | "baseurl" | "model" | "validating" | "error";

interface Flow {
  provider: Provider;
  label: string;
  desc: string;
  needsKey?: boolean;
  needsBaseUrl?: boolean;
  modelDefault?: string;
  modelHint?: string;
}

const FLOWS: Flow[] = [
  { provider: "claude-code", label: "Login with Claude", desc: "browser sign-in · full skills engine (recommended)" },
  { provider: "anthropic", label: "Anthropic API key", desc: "Bloom's own engine on the Claude API", needsKey: true, modelDefault: "claude-opus-4-8" },
  { provider: "openai", label: "OpenAI API key", desc: "Bloom's engine on OpenAI models", needsKey: true, modelHint: "model name, e.g. gpt-5.2" },
  { provider: "ollama", label: "Local model", desc: "Ollama on this machine · private, free", needsBaseUrl: true, modelDefault: "llama3.2:3b", modelHint: "7B+ models call tools far more reliably" },
];

export function Onboarding({ active }: { active: boolean }) {
  const setAuth = useStore((s) => s.setAuth);
  const setStatus = useStore((s) => s.setStatus);
  const [mode, setMode] = useState<Mode>("menu");
  const [idx, setIdx] = useState(0);
  const [flow, setFlow] = useState<Flow>(FLOWS[0]);
  const [field, setField] = useState("");
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [error, setError] = useState("");

  async function finish(f: Flow, apiKey: string, base: string, model: string) {
    setMode("validating");
    try {
      if (f.provider === "claude-code") {
        const name = await validateCredentials();
        saveAiConfig({ provider: "claude-code" });
        setAuth("ok");
        setStatus(`Bloom connected · Claude Code (${name})`);
        return;
      }
      const cfg = {
        provider: f.provider,
        model: model || f.modelDefault,
        apiKey: apiKey || undefined,
        baseUrl: base || undefined,
      };
      const name = await pingProvider(cfg);
      if (f.provider === "anthropic" && apiKey) storeApiKey(apiKey);
      saveAiConfig(cfg);
      setAuth("ok");
      setStatus(`Bloom connected · ${f.label} (${name})`);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const m = raw.match(/"message"\s*:\s*"([^"]+)"/);
      setError(m ? m[1] : raw.slice(0, 120));
      setMode("error");
    }
  }

  async function choose(i: number) {
    if (i >= FLOWS.length) {
      setAuth("skipped");
      setStatus("AI off · LOGIN ⏎ to connect Bloom");
      return;
    }
    const f = FLOWS[i];
    setFlow(f);
    setKey("");
    setBaseUrl("");
    if (f.provider === "claude-code") {
      if (detectCredentialSource() === "claude-login" || detectCredentialSource() === "env") {
        return void finish(f, "", "", "");
      }
      setMode("login-wait");
      const res = await runClaudeLogin();
      if (res.ok) return void finish(f, "", "", "");
      setError(res.message.slice(0, 120));
      setMode("error");
      return;
    }
    if (f.needsKey) {
      setField("");
      setMode("key");
    } else if (f.needsBaseUrl) {
      setField("http://localhost:11434/v1");
      setMode("baseurl");
    }
  }

  function submitField(valueOverride?: string) {
    const value = (valueOverride ?? field).trim();
    if (mode === "key") {
      if (!value) return;
      setKey(value);
      setField(flow.modelDefault ?? "");
      setMode("model");
    } else if (mode === "baseurl") {
      setBaseUrl(value);
      setField(flow.modelDefault ?? "");
      setMode("model");
    } else if (mode === "model") {
      if (!value && !flow.modelDefault) return;
      void finish(flow, key, baseUrl, value || flow.modelDefault || "");
    }
  }

  useInput(
    (input, k) => {
      const options = FLOWS.length + 1; // + skip
      if (mode === "menu") {
        if (k.upArrow) return setIdx((idx + options - 1) % options);
        if (k.downArrow) return setIdx((idx + 1) % options);
        if (k.return) return void choose(idx);
        const n = Number(input);
        if (n >= 1 && n <= options) return void choose(n - 1);
        return;
      }
      if (mode === "key" || mode === "baseurl" || mode === "model") {
        if (input.length > 1 && /[\r\n]/.test(input)) {
          const merged = (field + input.split(/[\r\n]/)[0]).trim();
          setField(merged);
          return submitField(merged);
        }
        if (k.return) return submitField();
        if (k.escape) return setMode("menu");
        if (k.backspace || k.delete) return setField(field.slice(0, -1));
        if (input && input >= " ") return setField(field + input.trim());
        return;
      }
      if (mode === "error") {
        setError("");
        return setMode("menu");
      }
    },
    { isActive: active },
  );

  const masked = mode === "key";
  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="double" borderColor={theme.amber} paddingX={3} paddingY={1}>
      <Text bold color={theme.amber}>
        ◆ WELCOME TO BLOOMMOUNTAIN
      </Text>
      <Text> </Text>
      <Text color={theme.text}>Market data needs nothing. Bloom, the AI analyst desk, needs a brain — bring your own:</Text>
      <Text> </Text>

      {mode === "menu" && (
        <>
          {FLOWS.map((f, i) => (
            <Box key={f.provider}>
              <Text color={i === idx ? theme.amber : theme.dim} bold={i === idx}>
                {i === idx ? "▶ " : "  "}
                {i + 1}. {f.label.padEnd(20)}
              </Text>
              <Text color={theme.dim}> {f.desc}</Text>
            </Box>
          ))}
          <Box>
            <Text color={idx === FLOWS.length ? theme.amber : theme.dim} bold={idx === FLOWS.length}>
              {idx === FLOWS.length ? "▶ " : "  "}
              {FLOWS.length + 1}. {"Skip for now".padEnd(20)}
            </Text>
            <Text color={theme.dim}> markets work without AI · connect later with LOGIN ⏎</Text>
          </Box>
          <Text> </Text>
          <Text color={theme.dim}>↑↓ move · ⏎ select · or press 1–{FLOWS.length + 1}</Text>
        </>
      )}

      {mode === "login-wait" && (
        <>
          <Text color={theme.amber}>⣾ Waiting for you to finish signing in…</Text>
          <Text color={theme.dim}>Your browser should have opened. Approve access there — nothing to copy back.</Text>
        </>
      )}

      {(mode === "key" || mode === "baseurl" || mode === "model") && (
        <>
          <Text color={theme.dim}>{flow.label}</Text>
          <Text color={theme.text}>
            {mode === "key" ? "API key" : mode === "baseurl" ? "endpoint URL" : "model"}
            {mode === "model" && (flow.modelHint ? ` (${flow.modelHint})` : "")}:{" "}
            <Text color={theme.amber}>{masked ? "•".repeat(Math.min(field.length, 40)) : field}█</Text>
          </Text>
          <Text color={theme.dim}>⏎ continue · esc back</Text>
        </>
      )}

      {mode === "validating" && <Text color={theme.amber}>⣾ Checking the connection…</Text>}

      {mode === "error" && (
        <>
          <Text color={theme.down}>✗ {error}</Text>
          <Text color={theme.dim}>press any key to go back</Text>
        </>
      )}
    </Box>
  );
}
