/**
 * BYOM agent engine: one tool-calling loop, two wire formats.
 *
 * - anthropic: official SDK (resolves env keys AND `ant auth login` profiles)
 * - openai/ollama/custom: OpenAI SDK with baseURL — covers every
 *   OpenAI-compatible endpoint (Ollama, Groq, Mistral, OpenRouter, …)
 *
 * The loop is ours, so the guardrail is structural: the tool registry
 * contains no trading tools for any provider.
 */
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { TOOLS, SYSTEM_PROMPT } from "./tools.js";
import { getClient } from "./credentials.js";
import type { AiConfig } from "./aiconfig.js";

const MAX_STEPS = 12;

export interface HistoryTurn {
  q: string;
  a: string;
}

async function execTool(name: string, args: Record<string, unknown>): Promise<string> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return `unknown tool: ${name}`;
  try {
    return await tool.run(args);
  } catch (err) {
    return `tool error: ${err instanceof Error ? err.message : err}`;
  }
}

/* ── Anthropic Messages API ─────────────────────────────────────── */

async function runAnthropic(cfg: AiConfig, history: HistoryTurn[], question: string, signal?: AbortSignal): Promise<string> {
  const client: Anthropic = cfg.apiKey ? new Anthropic({ apiKey: cfg.apiKey }) : getClient();
  const model = cfg.model || "claude-opus-4-8";
  const tools = TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool["input_schema"],
  }));
  const messages: Anthropic.MessageParam[] = [
    ...history.flatMap((h): Anthropic.MessageParam[] => [
      { role: "user", content: h.q },
      { role: "assistant", content: h.a || "(no answer)" },
    ]),
    { role: "user", content: question },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.messages.create(
      {
        model,
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        system: SYSTEM_PROMPT,
        tools,
        messages,
      },
      { signal },
    );
    if (response.stop_reason === "refusal") {
      return "The model declined this request (safety classifiers). Try rephrasing.";
    }
    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return text || "(empty answer)";
    }
    messages.push({ role: "assistant", content: response.content });
    const results = await Promise.all(
      toolUses.map(async (tu) => ({
        type: "tool_result" as const,
        tool_use_id: tu.id,
        content: await execTool(tu.name, tu.input as Record<string, unknown>),
      })),
    );
    messages.push({ role: "user", content: results });
  }
  return "(stopped after too many tool steps — try a narrower question)";
}

/* ── OpenAI-compatible chat completions ─────────────────────────── */

async function runOpenAI(cfg: AiConfig, history: HistoryTurn[], question: string, signal?: AbortSignal): Promise<string> {
  const client = new OpenAI({
    apiKey: cfg.apiKey || "not-needed",
    baseURL: cfg.baseUrl || (cfg.provider === "ollama" ? "http://localhost:11434/v1" : undefined),
  });
  const model = cfg.model || "";
  if (!model) return "No model configured — run LOGIN and set one.";
  const tools: OpenAI.Chat.ChatCompletionTool[] = TOOLS.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.flatMap((h): OpenAI.Chat.ChatCompletionMessageParam[] => [
      { role: "user", content: h.q },
      { role: "assistant", content: h.a || "(no answer)" },
    ]),
    { role: "user", content: question },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.chat.completions.create(
      // small local models often narrate instead of calling — force one tool use up front
      { model, messages, tools, tool_choice: step === 0 ? "required" : "auto" },
      { signal },
    );
    const msg = response.choices[0]?.message;
    if (!msg) return "(no response from model)";
    if (!msg.tool_calls?.length) return (msg.content ?? "").trim() || "(empty answer)";
    messages.push(msg);
    for (const tc of msg.tool_calls) {
      if (tc.type !== "function") continue;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {
        /* malformed args — tool will report */
      }
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: await execTool(tc.function.name, args),
      });
    }
  }
  return "(stopped after too many tool steps — try a narrower question)";
}

/* ── entry points ───────────────────────────────────────────────── */

export async function runAgent(cfg: AiConfig, history: HistoryTurn[], question: string, signal?: AbortSignal): Promise<string> {
  const q = `${question}\n\n(Answer for a terminal panel: under 200 words, plain text.)`;
  return cfg.provider === "anthropic" ? runAnthropic(cfg, history, q, signal) : runOpenAI(cfg, history, q, signal);
}

/** Cheap connectivity check for onboarding validation. */
export async function pingProvider(cfg: AiConfig): Promise<string> {
  if (cfg.provider === "anthropic") {
    const client: Anthropic = cfg.apiKey ? new Anthropic({ apiKey: cfg.apiKey }) : getClient();
    const m = await client.models.retrieve(cfg.model || "claude-opus-4-8", {}, { timeout: 15_000 });
    return m.display_name;
  }
  const client = new OpenAI({
    apiKey: cfg.apiKey || "not-needed",
    baseURL: cfg.baseUrl || (cfg.provider === "ollama" ? "http://localhost:11434/v1" : undefined),
    timeout: 15_000,
  });
  const res = await client.chat.completions.create({
    model: cfg.model || "",
    messages: [{ role: "user", content: "Reply with the single word: ok" }],
    max_tokens: 5,
  });
  if (!res.choices[0]?.message) throw new Error("no response");
  return cfg.model || "connected";
}
