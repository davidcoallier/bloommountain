/**
 * Paper trading: casino money, real quotes.
 *
 * First adapter behind the BUY/SELL commands — a real broker (e.g. Alpaca)
 * can slot in later behind the same interface. Fills at the current Yahoo
 * quote (delayed per exchange rules), long-only, fractional allowed via $.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fetchQuote, fetchQuotes, searchSymbols } from "./yahoo.js";

const DIR = join(homedir(), ".config", "bloommountain");
const FILE = join(DIR, "paper.json");
export const START_CASH = 100_000;

export interface Position {
  symbol: string;
  qty: number;
  avgCost: number;
}

export interface ClosedTrade {
  symbol: string;
  qty: number;
  entry: number;
  exit: number;
  pnl: number;
  at: string;
}

interface PaperState {
  cash: number;
  startCash: number;
  startedAt: string;
  /** S&P at account start — the honest benchmark. */
  spxStart: number | null;
  positions: Position[];
  closed: ClosedTrade[];
}

function fresh(): PaperState {
  return { cash: START_CASH, startCash: START_CASH, startedAt: new Date().toISOString(), spxStart: null, positions: [], closed: [] };
}

export function loadPaper(): PaperState {
  try {
    return { ...fresh(), ...JSON.parse(readFileSync(FILE, "utf8")) };
  } catch {
    return fresh();
  }
}

function save(state: PaperState): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(state, null, 2));
}

export function resetPaper(): void {
  save(fresh());
}

async function ensureBenchmark(state: PaperState): Promise<void> {
  if (state.spxStart == null) {
    try {
      state.spxStart = (await fetchQuote("^GSPC")).price;
    } catch {
      /* benchmark stays unset — shown as – */
    }
  }
}

export interface FillResult {
  ok: boolean;
  message: string;
}

export interface OrderPreview {
  side: "BUY" | "SELL";
  symbol: string;
  name: string;
  qtySpec: string;
  qty: number;
  fractional: boolean;
  price: number;
  value: number;
  cashBefore: number;
  cashAfter: number;
  /** SELL only: estimated realized P&L vs average cost. */
  estPnl: number | null;
  error?: string;
}

/** Price an order without executing — the confirmation ticket. */
export async function previewOrder(side: "BUY" | "SELL", symbol: string, qtySpec: string): Promise<OrderPreview> {
  const state = loadPaper();
  const blank: OrderPreview = {
    side, symbol, name: "", qtySpec, qty: 0, fractional: false, price: 0, value: 0,
    cashBefore: state.cash, cashAfter: state.cash, estPnl: null,
  };
  const pos = state.positions.find((p) => p.symbol === symbol);
  if (side === "SELL" && !pos) return { ...blank, error: `no position in ${symbol}` };
  let price: number;
  let name = "";
  try {
    const quote = await fetchQuote(symbol);
    if (quote.price == null) throw new Error("no price");
    price = quote.price;
    name = quote.name;
  } catch {
    const q = await quoteOrSuggest(symbol);
    return { ...blank, error: "error" in q ? q.error : `no quote for ${symbol}` };
  }
  let qty: number;
  let fractional = false;
  if (qtySpec.startsWith("$")) {
    const amount = Number(qtySpec.slice(1).replace(/,/g, ""));
    if (!isFinite(amount) || amount <= 0) return { ...blank, error: `bad amount ${qtySpec}` };
    qty = Math.round((amount / price) * 10000) / 10000;
    fractional = true;
  } else if (qtySpec === "ALL" && side === "SELL") {
    qty = pos?.qty ?? 0;
  } else {
    qty = Number(qtySpec);
    if (!isFinite(qty) || qty <= 0) return { ...blank, error: `bad quantity ${qtySpec}` };
  }
  const value = qty * price;
  if (side === "BUY" && value > state.cash) {
    if (!qtySpec.startsWith("$") && qty <= state.cash) {
      return { ...blank, error: `${qty} = shares: ${qty} × ${fmt(price)} ≈ ${fmt(value)} coins (you have ${fmt(state.cash)}). For ${fmt(qty)} coins' worth type BUY $${qtySpec} ${symbol}` };
    }
    return { ...blank, error: `${qty} shares ≈ ${fmt(value)} coins, have ${fmt(state.cash)} — max is about BUY $${Math.floor(state.cash)} ${symbol}` };
  }
  if (side === "SELL" && pos && qty > pos.qty + 1e-9) {
    return { ...blank, error: `only ${pos.qty} ${symbol} held (long-only casino)` };
  }
  return {
    side, symbol, name, qtySpec, qty, fractional, price, value,
    cashBefore: state.cash,
    cashAfter: side === "BUY" ? state.cash - value : state.cash + value,
    estPnl: side === "SELL" && pos ? (price - pos.avgCost) * qty : null,
  };
}

/** qtySpec: "10" shares or "$5000" notional. */
async function quoteOrSuggest(symbol: string): Promise<{ price: number } | { error: string }> {
  try {
    const quote = await fetchQuote(symbol);
    if (quote.price != null) return { price: quote.price };
  } catch {
    /* unknown symbol — suggest below */
  }
  try {
    const hit = (await searchSymbols(symbol, 1))[0];
    if (hit) return { error: `no quote for ${symbol} — did you mean ${hit.symbol} (${hit.name})?` };
  } catch {
    /* search also failed */
  }
  return { error: `no quote for ${symbol}` };
}

export async function paperBuy(symbol: string, qtySpec: string): Promise<FillResult> {
  const state = loadPaper();
  const q = await quoteOrSuggest(symbol);
  if ("error" in q) return { ok: false, message: q.error };
  const quote = q;
  const price = quote.price;

  let qty: number;
  if (qtySpec.startsWith("$")) {
    const amount = Number(qtySpec.slice(1).replace(/,/g, ""));
    if (!isFinite(amount) || amount <= 0) return { ok: false, message: `bad amount ${qtySpec}` };
    qty = Math.round((amount / price) * 10000) / 10000; // fractional, 4dp
  } else {
    qty = Number(qtySpec);
    if (!isFinite(qty) || qty <= 0) return { ok: false, message: `bad quantity ${qtySpec}` };
  }
  const cost = qty * price;
  if (cost > state.cash) {
    // teach the grammar: bare number = shares, $ = coins
    if (!qtySpec.startsWith("$") && qty <= state.cash) {
      return {
        ok: false,
        message: `${qty} = shares: ${qty} × ${fmt(price)} ≈ ${fmt(cost)} coins (you have ${fmt(state.cash)}). For ${fmt(qty)} coins' worth type BUY $${qtySpec} ${symbol}`,
      };
    }
    return { ok: false, message: `${qty} shares ≈ ${fmt(cost)} coins, have ${fmt(state.cash)} — max is about BUY $${Math.floor(state.cash)} ${symbol}` };
  }
  await ensureBenchmark(state);
  const pos = state.positions.find((p) => p.symbol === symbol);
  if (pos) {
    pos.avgCost = (pos.avgCost * pos.qty + cost) / (pos.qty + qty);
    pos.qty += qty;
  } else {
    state.positions.push({ symbol, qty, avgCost: price });
  }
  state.cash -= cost;
  save(state);
  return { ok: true, message: `✔ bought ${qty} ${symbol} @ ${fmt(price)} · ${fmt(cost)} coins · cash ${fmt(state.cash)}` };
}

export async function paperSell(symbol: string, qtySpec: string): Promise<FillResult> {
  const state = loadPaper();
  const pos = state.positions.find((p) => p.symbol === symbol);
  if (!pos) return { ok: false, message: `no position in ${symbol}` };
  const q = await quoteOrSuggest(symbol);
  if ("error" in q) return { ok: false, message: q.error };
  const quote = q;
  const price = quote.price;

  let qty = qtySpec === "ALL" ? pos.qty : Number(qtySpec);
  if (qtySpec.startsWith("$")) {
    const amount = Number(qtySpec.slice(1).replace(/,/g, ""));
    qty = Math.round((amount / price) * 10000) / 10000;
  }
  if (!isFinite(qty) || qty <= 0) return { ok: false, message: `bad quantity ${qtySpec}` };
  if (qty > pos.qty + 1e-9) return { ok: false, message: `only ${pos.qty} ${symbol} held (long-only casino)` };

  qty = Math.min(qty, pos.qty);
  const proceeds = qty * price;
  const pnl = (price - pos.avgCost) * qty;
  pos.qty = Math.round((pos.qty - qty) * 10000) / 10000;
  state.cash += proceeds;
  state.closed.push({ symbol, qty, entry: pos.avgCost, exit: price, pnl, at: new Date().toISOString() });
  if (pos.qty <= 1e-9) state.positions = state.positions.filter((p) => p !== pos);
  save(state);
  const sign = pnl >= 0 ? "+" : "";
  return { ok: true, message: `✔ sold ${qty} ${symbol} @ ${fmt(price)} · P&L ${sign}${fmt(pnl)} · cash ${fmt(state.cash)}` };
}

export interface PaperBook {
  state: PaperState;
  rows: (Position & { price: number | null; value: number; pnl: number; pnlPct: number; dayPct: number | null })[];
  equity: number;
  totalReturn: number;
  realized: number;
  benchmarkReturn: number | null;
}

export async function paperBook(): Promise<PaperBook> {
  const state = loadPaper();
  const symbols = state.positions.map((p) => p.symbol);
  const quotes = symbols.length ? await fetchQuotes([...symbols, "^GSPC"]) : await fetchQuotes(["^GSPC"]);
  const spx = quotes[quotes.length - 1];
  const rows = state.positions.map((p, i) => {
    const price = quotes[i]?.price ?? null;
    const value = (price ?? p.avgCost) * p.qty;
    const pnl = value - p.avgCost * p.qty;
    return { ...p, price, value, pnl, pnlPct: pnl / (p.avgCost * p.qty), dayPct: quotes[i]?.pct ?? null };
  });
  const equity = state.cash + rows.reduce((a, r) => a + r.value, 0);
  const realized = state.closed.reduce((a, c) => a + c.pnl, 0);
  const benchmarkReturn =
    state.spxStart != null && spx?.price != null ? spx.price / state.spxStart - 1 : null;
  return { state, rows, equity, totalReturn: equity / state.startCash - 1, realized, benchmarkReturn };
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
