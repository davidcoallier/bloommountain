/**
 * Claude API credential handling for AI features.
 *
 * Resolution order mirrors the Anthropic SDK: ANTHROPIC_API_KEY /
 * ANTHROPIC_AUTH_TOKEN env vars, then an `ant auth login` OAuth profile
 * (~/.config/anthropic), then a key we stored ourselves during onboarding.
 */
import Anthropic from "@anthropic-ai/sdk";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DIR = join(homedir(), ".config", "bloommountain");
const FILE = join(DIR, "credentials.json");

export type AuthSource = "env" | "claude-login" | "stored" | null;

function anthropicConfigDir(): string {
  if (process.env.ANTHROPIC_CONFIG_DIR) return process.env.ANTHROPIC_CONFIG_DIR;
  if (process.platform === "win32" && process.env.APPDATA) return join(process.env.APPDATA, "Anthropic");
  return join(homedir(), ".config", "anthropic");
}

export function loadStoredKey(): string | null {
  try {
    const data = JSON.parse(readFileSync(FILE, "utf8"));
    return typeof data.apiKey === "string" && data.apiKey ? data.apiKey : null;
  } catch {
    return null;
  }
}

export function storeApiKey(apiKey: string): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify({ apiKey }, null, 2), { mode: 0o600 });
}

export function clearStoredKey(): void {
  try {
    unlinkSync(FILE);
  } catch {
    /* nothing stored */
  }
}

export function detectCredentialSource(): AuthSource {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return "env";
  try {
    const credDir = join(anthropicConfigDir(), "credentials");
    if (existsSync(credDir) && readdirSync(credDir).some((f) => f.endsWith(".json"))) {
      return "claude-login";
    }
  } catch {
    /* unreadable — treat as absent */
  }
  if (loadStoredKey()) return "stored";
  return null;
}

/** Client using whatever credential source is active. */
export function getClient(): Anthropic {
  const stored = loadStoredKey();
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN && stored) {
    return new Anthropic({ apiKey: stored });
  }
  return new Anthropic(); // env var or ant-login profile, resolved by the SDK
}

/** Cheap round-trip to prove the credential works. Returns the model name. */
export async function validateCredentials(apiKey?: string): Promise<string> {
  const client = apiKey ? new Anthropic({ apiKey }) : getClient();
  const model = await client.models.retrieve("claude-opus-4-8", {}, { timeout: 15_000 });
  return model.display_name;
}

/**
 * Run `ant auth login` — the official browser OAuth flow. No copy-paste:
 * the CLI opens the browser and stores a profile the SDK reads automatically.
 */
export function runClaudeLogin(): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    let out = "";
    let child;
    try {
      child = spawn("ant", ["auth", "login"], { stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      return resolve({ ok: false, message: "could not start ant" });
    }
    child.stdout?.on("data", (d) => (out += d.toString()));
    child.stderr?.on("data", (d) => (out += d.toString()));
    child.on("error", (err: NodeJS.ErrnoException) => {
      resolve({
        ok: false,
        message:
          err.code === "ENOENT"
            ? "Anthropic CLI not found. Install it first: brew install anthropics/tap/ant"
            : `ant failed to start: ${err.message}`,
      });
    });
    child.on("exit", (code) => {
      if (code === 0) resolve({ ok: true, message: "login complete" });
      else resolve({ ok: false, message: out.trim().split("\n").pop() || `ant exited with code ${code}` });
    });
  });
}
