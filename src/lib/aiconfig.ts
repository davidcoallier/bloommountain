/** BYOM configuration: which brain runs the desk. */
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DIR = join(homedir(), ".config", "bloommountain");
const FILE = join(DIR, "ai.json");

export type Provider = "claude-code" | "anthropic" | "openai" | "ollama" | "custom";

export interface AiConfig {
  provider: Provider;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export const PROVIDER_LABELS: Record<Provider, string> = {
  "claude-code": "Claude Code",
  anthropic: "Anthropic API",
  openai: "OpenAI",
  ollama: "Ollama (local)",
  custom: "Custom endpoint",
};

export function loadAiConfig(): AiConfig {
  try {
    const cfg = JSON.parse(readFileSync(FILE, "utf8"));
    if (cfg.provider) return cfg;
  } catch {
    /* not configured */
  }
  return { provider: "claude-code" }; // existing behaviour: claude CLI
}

export function saveAiConfig(cfg: AiConfig): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

export function isAiConfigured(): boolean {
  try {
    readFileSync(FILE, "utf8");
    return true;
  } catch {
    return false;
  }
}

export function clearAiConfig(): void {
  try {
    unlinkSync(FILE);
  } catch {
    /* nothing stored */
  }
}
