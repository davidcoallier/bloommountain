import { useEffect, useRef, useState } from "react";
import { searchSymbols, type SymbolSuggestion } from "../lib/yahoo.js";
import { PERIOD_KEYS } from "../lib/periods.js";
import { STRATEGY_KEYS } from "../lib/strategies.js";

const COMMAND_WORDS = new Set([
  "Q", "QUIT", "EXIT", "HELP", "NEWS", "STRAT", "FUT", "FUTURES", "HIST", "ANALYSES", "AI", "LOGIN", "LOGOUT", "ASK", "BUY", "SELL", "PORT", "PAPER", "ADD", "RM", "DEL",
  ...STRATEGY_KEYS,
  ...PERIOD_KEYS,
]);

/** What to autocomplete for the current command buffer, if anything. */
function parse(buffer: string, watchlist: string[]): { term: string; local: string[] | null } {
  const m = buffer.match(/^\s*(ADD|RM|DEL)\s+(.*)$/i);
  const verb = m?.[1]?.toUpperCase();
  const term = (m ? m[2] : buffer).trim();
  if (term.length < 2 || COMMAND_WORDS.has(term.toUpperCase())) return { term: "", local: null };
  // three or more words reads as a question for Claude, not a symbol search
  if (!m && term.split(/\s+/).length >= 3) return { term: "", local: null };
  // RM/DEL completes from the watchlist itself, no network needed
  if (verb === "RM" || verb === "DEL") {
    return { term, local: watchlist.filter((s) => s.startsWith(term.toUpperCase())) };
  }
  return { term, local: null };
}

/**
 * Debounced symbol autocomplete for the command line.
 * Searches Yahoo's universe as the user types (bare queries and after ADD),
 * or filters the watchlist after RM/DEL.
 */
export function useSuggestions(
  buffer: string,
  watchlist: string[],
): { suggestions: SymbolSuggestion[]; index: number; setIndex: (i: number) => void } {
  const [suggestions, setSuggestions] = useState<SymbolSuggestion[]>([]);
  const [index, setIndex] = useState(0);
  const seq = useRef(0);

  const { term, local } = parse(buffer, watchlist);

  useEffect(() => {
    const id = ++seq.current;
    setIndex(0);
    if (!term) {
      setSuggestions([]);
      return;
    }
    if (local) {
      setSuggestions(local.map((s) => ({ symbol: s, name: "on watchlist", type: "", exchange: "" })));
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await searchSymbols(term);
        if (seq.current === id) setSuggestions(results);
      } catch {
        if (seq.current === id) setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, local?.join(",")]);

  return { suggestions, index, setIndex };
}
