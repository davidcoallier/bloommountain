import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DIR = join(homedir(), ".config", "bloommountain");
const FILE = join(DIR, "watchlist.json");

export const DEFAULT_WATCHLIST = [
  "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META",
  "^GSPC", "^FTSE", "^ISEQ",
  "EURUSD=X", "BTC-USD", "CL=F", "GC=F",
];

export function loadWatchlist(): string[] {
  try {
    const data = JSON.parse(readFileSync(FILE, "utf8"));
    if (Array.isArray(data) && data.length > 0) return data.map((s) => String(s).toUpperCase());
  } catch {
    /* first run */
  }
  return [...DEFAULT_WATCHLIST];
}

export function saveWatchlist(symbols: string[]): void {
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(symbols, null, 2));
  } catch {
    /* non-fatal */
  }
}
