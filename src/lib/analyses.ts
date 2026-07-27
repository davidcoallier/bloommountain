/** Persisted AI analyses: conversations of question/answer exchanges. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DIR = join(homedir(), ".config", "bloommountain");
const FILE = join(DIR, "analyses.json");
const MAX = 50;

export interface Exchange {
  q: string;
  a: string;
  at: string; // ISO
  failed?: boolean;
}

export interface Conversation {
  id: number;
  /** claude CLI session id — lets follow-ups resume with full context. */
  sessionId?: string;
  startedAt: string;
  exchanges: Exchange[];
}

export function loadConversations(): Conversation[] {
  try {
    const data = JSON.parse(readFileSync(FILE, "utf8"));
    if (Array.isArray(data.conversations)) return data.conversations;
  } catch {
    /* first run */
  }
  return [];
}

export function saveConversations(conversations: Conversation[]): void {
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify({ conversations: conversations.slice(0, MAX) }, null, 2));
  } catch {
    /* non-fatal */
  }
}
