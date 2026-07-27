/**
 * Provider-neutral tool registry for the BYOM engine.
 *
 * Every analysis script becomes a tool any model can call. Deliberately
 * absent: anything that trades or writes — models analyse, humans execute.
 */
import { spawn } from "node:child_process";
import { fetchQuotes } from "./yahoo.js";
import { fmtPct, fmtPrice } from "./format.js";

export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema for the arguments. */
  parameters: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<string>;
}

function runScript(script: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    let out = "";
    let err = "";
    const child = spawn("npx", ["tsx", `scripts/${script}`, ...args], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    const timer = setTimeout(() => child.kill(), 120_000);
    child.stdout?.on("data", (d) => (out += d.toString()));
    child.stderr?.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve(`tool error: ${e.message}`);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      const text = (out || err).trim().slice(0, 30_000);
      resolve(code === 0 && text ? text : `tool failed (exit ${code}): ${text.slice(0, 500)}`);
    });
  });
}

const sym = { type: "object", properties: { symbol: { type: "string", description: "Yahoo Finance symbol, e.g. AAPL, RYA.IR, CL=F, BTC-USD" } }, required: ["symbol"], additionalProperties: false };
const none = { type: "object", properties: {}, additionalProperties: false };

export const TOOLS: ToolDef[] = [
  {
    name: "get_quotes",
    description: "Live delayed quotes for one or more symbols: price, day change, 52w range, market cap, P/E. Fast — use for any current-price question.",
    parameters: { type: "object", properties: { symbols: { type: "array", items: { type: "string" }, description: "Yahoo symbols" } }, required: ["symbols"], additionalProperties: false },
    run: async (a) => {
      // lenient args: weak models send {symbol: "X"} or a bare string
      const raw = a.symbols ?? a.symbol ?? a.ticker;
      const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[,\s]+/) : [];
      if (!list.length) return "get_quotes needs symbols, e.g. {\"symbols\": [\"GC=F\"]}";
      const quotes = await fetchQuotes(list.map((s) => String(s).toUpperCase()));
      return quotes
        .map((q) => `${q.symbol} (${q.name}): ${fmtPrice(q.price)} ${q.currency} ${fmtPct(q.pct)} today · 52w ${fmtPrice(q.yearLow)}-${fmtPrice(q.yearHigh)} · mcap ${q.marketCap ?? "–"} · P/E ${q.pe ?? "–"} · ${q.marketState}`)
        .join("\n");
    },
  },
  { name: "financial_analyst", description: "Fundamentals data pack for a stock: valuation multiples, margins, growth, balance sheet, analyst targets.", parameters: sym, run: (a) => runScript("analyst.ts", [String(a.symbol)]) },
  { name: "comparables", description: "Peer-multiples table for a stock vs its peer group, with premium/discount to the peer median.", parameters: sym, run: (a) => runScript("comps.ts", [String(a.symbol)]) },
  { name: "forecaster", description: "Statistical forecast: realized volatility, trend read, Monte Carlo price cone. Use for 'where could X be' and downside questions.", parameters: { type: "object", properties: { symbol: { type: "string" }, days: { type: "number", description: "horizon in trading days, default 30" } }, required: ["symbol"], additionalProperties: false }, run: (a) => runScript("forecaster.ts", [String(a.symbol), ...(a.days ? ["--days", String(a.days)] : [])]) },
  { name: "earnings_scout", description: "Next earnings date, consensus EPS, beat/miss history, options-implied move into the print.", parameters: sym, run: (a) => runScript("earnings.ts", [String(a.symbol)]) },
  { name: "options_chain", description: "Options read: implied move, ATM IV, put/call ratios, open-interest walls, unusual volume.", parameters: sym, run: (a) => runScript("options.ts", [String(a.symbol)]) },
  { name: "market_connector", description: "Why is X moving: correlations and beta vs oil, gold, dollar, rates, S&P + news flow of correlated assets.", parameters: { type: "object", properties: { symbol: { type: "string" }, days: { type: "number", description: "correlation window, default 180" } }, required: ["symbol"], additionalProperties: false }, run: (a) => runScript("connector.ts", [String(a.symbol), ...(a.days ? ["--days", String(a.days)] : [])]) },
  { name: "market_discovery", description: "Find what's moving or find tickers. mode: 'trending' | 'gainers' | 'losers' | 'actives', or a free-text theme/company query.", parameters: { type: "object", properties: { mode: { type: "string", description: "trending|gainers|losers|actives or a search query" } }, required: ["mode"], additionalProperties: false }, run: (a) => { const m = String(a.mode); return runScript("discovery.ts", [["trending", "gainers", "losers", "actives"].includes(m) ? `--${m}` : m]); } },
  { name: "futures_desk", description: "Futures board (energy/metals/ags/indices/rates), implied fed funds rate, Polymarket+Kalshi macro odds, commodity news wire.", parameters: none, run: () => runScript("futures.ts", []) },
  { name: "macro_dashboard", description: "US yield curve and 10Y-3M spread, implied fed rate, dollar/gold/oil/VIX tape, macro headlines.", parameters: none, run: () => runScript("macro.ts", []) },
  { name: "smart_money", description: "Insider transactions, net insider buying/selling, top 13F institutional holders with quarterly changes.", parameters: sym, run: (a) => runScript("smartmoney.ts", [String(a.symbol)]) },
  { name: "short_interest", description: "Short interest: shares short, % of float, days to cover, squeeze-setup verdict.", parameters: sym, run: (a) => runScript("squeeze.ts", [String(a.symbol)]) },
  { name: "dividend_safety", description: "Dividend sustainability: yield vs history, payout ratio, FCF coverage, red flags.", parameters: sym, run: (a) => runScript("dividends.ts", [String(a.symbol)]) },
  { name: "backtest", description: "Backtest the terminal's 15 chart strategies on a symbol vs buy & hold: trades, win rate, return, max drawdown.", parameters: { type: "object", properties: { symbol: { type: "string" }, period: { type: "string", description: "1Y or 5Y, default 5Y" } }, required: ["symbol"], additionalProperties: false }, run: (a) => runScript("backtest.ts", [String(a.symbol), "--period", String(a.period ?? "5Y")]) },
  { name: "portfolio_risk", description: "The user's paper-trading book marked to market: positions, weights, correlations, VaR, concentration. Read-only.", parameters: none, run: () => runScript("portfolio.ts", ["--paper"]) },
];

export const SYSTEM_PROMPT = `You are Bloom, the analyst desk inside the bloommountain terminal. Your answers appear in a terminal panel.

Rules:
- Any claim about prices, odds, fundamentals, or news must come from a tool call in this conversation. Never quote market numbers from memory.
- Pick the right desk: quotes for prices, market_connector for "why is X moving", earnings_scout + options_chain before earnings, futures_desk/macro_dashboard for rates and commodities, financial_analyst + comparables for valuation.
- For "should I buy X" questions, act as the chief investment officer: gather fundamentals, comps, catalysts and positioning, then write a short memo — verdict with confidence, the case in two or three points, the bear case, what's priced in, and the observable conditions that would invalidate the view.
- Be honest about model limits: correlations are windowed, prediction-market odds are prices not truths, backtests exclude costs.
- You have no trading tools and never will. If asked to execute a trade, tell the user to type the BUY/SELL command themselves.
- Keep answers under 200 words unless asked for depth. Plain text, no markdown headers.`;
