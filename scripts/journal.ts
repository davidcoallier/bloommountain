/**
 * Trade journal: log theses at entry, close with outcomes, review your
 * actual hit rate. Data: ~/.config/bloommountain/journal.json
 *
 * Usage:
 *   npx tsx scripts/journal.ts add --symbol NVDA --side long --thesis "..." [--price 206.84]
 *   npx tsx scripts/journal.ts close --id 3 [--price 215]
 *   npx tsx scripts/journal.ts list
 *   npx tsx scripts/journal.ts review
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fetchQuote } from "../src/lib/yahoo.js";
import { fmtPct, fmtPrice } from "../src/lib/format.js";

const FILE = join(homedir(), ".config", "bloommountain", "journal.json");

interface Entry {
  id: number;
  symbol: string;
  side: "long" | "short";
  thesis: string;
  entryPrice: number;
  entryDate: string;
  exitPrice?: number;
  exitDate?: string;
}

function load(): Entry[] {
  try {
    return JSON.parse(readFileSync(FILE, "utf8")).entries ?? [];
  } catch {
    return [];
  }
}
function save(entries: Entry[]): void {
  if (!existsSync(dirname(FILE))) mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify({ entries }, null, 2));
}
function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : undefined;
}
function ret(e: Entry, price: number): number {
  const r = price / e.entryPrice - 1;
  return e.side === "short" ? -r : r;
}

const cmd = process.argv[2];
const entries = load();

if (cmd === "add") {
  const symbol = arg("--symbol")?.toUpperCase();
  const side = (arg("--side") ?? "long") as Entry["side"];
  const thesis = arg("--thesis") ?? "";
  if (!symbol || !thesis) {
    console.error('usage: journal.ts add --symbol X --side long|short --thesis "why" [--price P]');
    process.exit(1);
  }
  const price = arg("--price") ? Number(arg("--price")) : (await fetchQuote(symbol)).price;
  if (price == null) {
    console.error(`no price for ${symbol}`);
    process.exit(1);
  }
  const id = (entries[entries.length - 1]?.id ?? 0) + 1;
  entries.push({ id, symbol, side, thesis, entryPrice: price, entryDate: new Date().toISOString().slice(0, 10) });
  save(entries);
  console.log(`#${id} ${side.toUpperCase()} ${symbol} @ ${fmtPrice(price)} — "${thesis}"`);
} else if (cmd === "close") {
  const id = Number(arg("--id"));
  const e = entries.find((x) => x.id === id && !x.exitDate);
  if (!e) {
    console.error(`no open entry #${id}`);
    process.exit(1);
  }
  const price = arg("--price") ? Number(arg("--price")) : (await fetchQuote(e.symbol)).price;
  if (price == null) {
    console.error(`no price for ${e.symbol}`);
    process.exit(1);
  }
  e.exitPrice = price;
  e.exitDate = new Date().toISOString().slice(0, 10);
  save(entries);
  console.log(`#${id} closed ${e.symbol} @ ${fmtPrice(price)} → ${fmtPct(ret(e, price) * 100)}`);
} else if (cmd === "list" || cmd === "review" || !cmd) {
  if (!entries.length) {
    console.log(`Journal empty. Log your first thesis:\n  npx tsx scripts/journal.ts add --symbol NVDA --side long --thesis "your reason"`);
    process.exit(0);
  }
  const open = entries.filter((e) => !e.exitDate);
  const closed = entries.filter((e) => e.exitDate);
  if (open.length) {
    console.log(`# Open (${open.length})\n`);
    console.log(`| id | date | side | symbol | entry | now | P&L | thesis |`);
    console.log(`|---|---|---|---|---|---|---|---|`);
    for (const e of open) {
      const q = await fetchQuote(e.symbol).catch(() => null);
      const now = q?.price ?? null;
      console.log(
        `| ${e.id} | ${e.entryDate} | ${e.side} | ${e.symbol} | ${fmtPrice(e.entryPrice)} | ${fmtPrice(now)} | ${now != null ? fmtPct(ret(e, now) * 100) : "–"} | ${e.thesis.slice(0, 60)} |`,
      );
    }
  }
  if (closed.length) {
    const rets = closed.map((e) => ret(e, e.exitPrice!));
    const wins = rets.filter((r) => r > 0);
    const losses = rets.filter((r) => r <= 0);
    console.log(`\n# Closed (${closed.length})\n`);
    console.log(`| id | held | side | symbol | entry → exit | P&L | thesis |`);
    console.log(`|---|---|---|---|---|---|---|`);
    for (const e of closed)
      console.log(
        `| ${e.id} | ${e.entryDate} → ${e.exitDate} | ${e.side} | ${e.symbol} | ${fmtPrice(e.entryPrice)} → ${fmtPrice(e.exitPrice)} | ${fmtPct(ret(e, e.exitPrice!) * 100)} | ${e.thesis.slice(0, 50)} |`,
      );
    console.log(
      `\nHit rate **${((wins.length / rets.length) * 100).toFixed(0)}%** · avg win ${wins.length ? fmtPct((wins.reduce((a, b) => a + b, 0) / wins.length) * 100) : "–"} · avg loss ${losses.length ? fmtPct((losses.reduce((a, b) => a + b, 0) / losses.length) * 100) : "–"} · expectancy ${fmtPct((rets.reduce((a, b) => a + b, 0) / rets.length) * 100)} per trade`,
    );
  }
} else {
  console.error("usage: journal.ts add|close|list|review");
  process.exit(1);
}
