/**
 * Ask Bloom from inside the terminal.
 *
 * Two engines behind one call:
 *  - claude-code: spawns `claude -p` in the repo, so the Claude Code skills
 *    load and run their scripts; follow-ups resume the CLI session.
 *  - BYOM (anthropic / openai / ollama / custom): our own tool-calling loop
 *    (src/lib/engine.ts) over the same analysis scripts; follow-ups replay
 *    the stored conversation.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { loadAiConfig } from "./aiconfig.js";
import { runAgent, type HistoryTurn } from "./engine.js";

let currentChild: ChildProcess | null = null;
let currentAbort: AbortController | null = null;

export interface AskResult {
  ok: boolean;
  text: string;
  sessionId?: string;
}

export interface AskOptions {
  /** claude-code engine: CLI session to resume. */
  resumeSessionId?: string;
  /** BYOM engines: prior completed exchanges for context. */
  history?: HistoryTurn[];
}

/** True when input reads like a question rather than a symbol/command. */
export function looksLikeQuestion(input: string): boolean {
  const t = input.trim();
  if (t.endsWith("?")) return true;
  return t.split(/\s+/).length >= 3;
}

export function askClaude(question: string, opts: AskOptions, onDone: (res: AskResult) => void): void {
  cancelAsk();
  const cfg = loadAiConfig();
  if (cfg.provider !== "claude-code") {
    const abort = new AbortController();
    currentAbort = abort;
    runAgent(cfg, opts.history ?? [], question, abort.signal)
      .then((text) => {
        if (abort.signal.aborted) return;
        if (currentAbort === abort) currentAbort = null;
        onDone({ ok: true, text });
      })
      .catch((err) => {
        if (abort.signal.aborted) return;
        if (currentAbort === abort) currentAbort = null;
        const msg = err instanceof Error ? err.message : String(err);
        const m = msg.match(/"message"\s*:\s*"([^"]+)"/);
        onDone({ ok: false, text: m ? m[1] : msg.slice(0, 160) });
      });
    return;
  }

  let out = "";
  let err = "";
  const prompt = `${question}\n\nAnswer for a terminal panel: under 200 words, no headers, plain text.`;
  // headless mode can't show permission prompts — pre-approve the repo's
  // analysis scripts and web search so the skills can actually fetch data
  const allowed = "Bash(npx tsx scripts/*),Bash(npx tsx *),WebSearch";
  const args = ["-p", prompt, "--output-format", "json", "--allowedTools", allowed];
  if (opts.resumeSessionId) args.push("--resume", opts.resumeSessionId);

  let child: ChildProcess;
  try {
    child = spawn("claude", args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, FORCE_COLOR: "0" },
    });
  } catch {
    return onDone({ ok: false, text: "could not start the claude CLI" });
  }
  currentChild = child;
  child.stdout?.on("data", (d) => (out += d.toString()));
  child.stderr?.on("data", (d) => (err += d.toString()));
  child.on("error", (e: NodeJS.ErrnoException) => {
    if (currentChild === child) currentChild = null;
    onDone({
      ok: false,
      text:
        e.code === "ENOENT"
          ? "claude CLI not found — install Claude Code, or LOGIN and pick another provider"
          : `claude failed to start: ${e.message}`,
    });
  });
  child.on("exit", (code, signal) => {
    if (currentChild === child) currentChild = null;
    if (signal) return; // cancelled by user
    if (code === 0 && out.trim()) {
      // the CLI may print warnings (workspace trust, etc.) before the JSON body
      const jsonStart = out.indexOf("{");
      if (jsonStart >= 0) {
        try {
          const parsed = JSON.parse(out.slice(jsonStart)) as { result?: string; session_id?: string };
          if (parsed.result) return onDone({ ok: true, text: parsed.result.trim(), sessionId: parsed.session_id });
        } catch {
          /* non-JSON — fall through to raw text */
        }
      }
      const text = out
        .split("\n")
        .filter((l) => !/^(Ignoring \d+ permissions|Warning:)/.test(l.trim()))
        .join("\n")
        .trim();
      return onDone({ ok: true, text });
    }
    onDone({
      ok: false,
      text: (err || out).trim().split("\n").slice(-3).join("\n") || `claude exited with code ${code}`,
    });
  });
}

export function cancelAsk(): void {
  if (currentChild) {
    currentChild.kill();
    currentChild = null;
  }
  if (currentAbort) {
    currentAbort.abort();
    currentAbort = null;
  }
}
