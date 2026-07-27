/**
 * Typed data layer over Yahoo Finance public endpoints (yahoo-finance2 v4).
 * Everything the TUI and the analyst scripts consume goes through here.
 */
import YahooFinance from "yahoo-finance2";
import { PERIODS, type PeriodKey } from "./periods.js";

export const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey", "ripHistorical"],
});

export interface Quote {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  pct: number | null;
  open: number | null;
  dayLow: number | null;
  dayHigh: number | null;
  yearLow: number | null;
  yearHigh: number | null;
  volume: number | null;
  marketCap: number | null;
  pe: number | null;
  currency: string;
  exchange: string;
  marketState: string;
}

export interface Candle {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NewsItem {
  title: string;
  publisher: string;
  published: Date | null;
  link: string;
}

function num(v: unknown): number | null {
  return typeof v === "number" && isFinite(v) ? v : null;
}

function mapQuote(q: Record<string, unknown>): Quote {
  return {
    symbol: String(q.symbol ?? ""),
    name: String(q.shortName ?? q.longName ?? ""),
    price: num(q.regularMarketPrice),
    change: num(q.regularMarketChange),
    pct: num(q.regularMarketChangePercent),
    open: num(q.regularMarketOpen),
    dayLow: num(q.regularMarketDayLow),
    dayHigh: num(q.regularMarketDayHigh),
    yearLow: num(q.fiftyTwoWeekLow),
    yearHigh: num(q.fiftyTwoWeekHigh),
    volume: num(q.regularMarketVolume),
    marketCap: num(q.marketCap),
    pe: num(q.trailingPE),
    currency: String(q.currency ?? ""),
    exchange: String(q.fullExchangeName ?? q.exchange ?? ""),
    marketState: String(q.marketState ?? ""),
  };
}

export async function fetchQuote(symbol: string): Promise<Quote> {
  const q = (await yf.quote(symbol)) as unknown as Record<string, unknown>;
  if (!q) throw new Error(`no quote for ${symbol}`);
  return mapQuote(q);
}

export async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  if (symbols.length === 0) return [];
  const res = (await yf.quote(symbols)) as unknown as Record<string, unknown>[];
  const bySymbol = new Map(res.map((q) => [String(q.symbol), mapQuote(q)]));
  return symbols.map(
    (s) =>
      bySymbol.get(s) ?? {
        ...mapQuote({ symbol: s }),
      },
  );
}

export async function fetchCandles(symbol: string, period: PeriodKey): Promise<Candle[]> {
  const spec = PERIODS[period];
  const res = await yf.chart(symbol, {
    period1: new Date(Date.now() - spec.lookbackMs),
    interval: spec.interval,
    includePrePost: false,
  });
  let candles: Candle[] = (res.quotes ?? [])
    .filter((q) => q.close != null && q.open != null && q.high != null && q.low != null)
    .map((q) => ({
      date: new Date(q.date),
      open: q.open as number,
      high: q.high as number,
      low: q.low as number,
      close: q.close as number,
      volume: (q.volume as number) ?? 0,
    }));
  if (spec.lastDayOnly && candles.length > 0) {
    const lastDay = candles[candles.length - 1].date.toDateString();
    candles = candles.filter((c) => c.date.toDateString() === lastDay);
  }
  return candles;
}

export async function fetchNews(symbol: string, count = 8): Promise<NewsItem[]> {
  const res = await yf.search(symbol, { newsCount: count, quotesCount: 0 });
  return (res.news ?? []).map((n) => ({
    title: n.title ?? "",
    publisher: n.publisher ?? "",
    published: n.providerPublishTime ? new Date(n.providerPublishTime) : null,
    link: n.link ?? "",
  }));
}

export interface SymbolSuggestion {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

/** Autocomplete: match companies/ETFs/FX/futures/crypto by name or symbol. */
export async function searchSymbols(query: string, count = 6): Promise<SymbolSuggestion[]> {
  const res = await yf.search(query, { quotesCount: count, newsCount: 0 });
  return (res.quotes ?? [])
    .filter((q) => "symbol" in q)
    .map((q) => {
      const r = q as unknown as Record<string, unknown>;
      return {
        symbol: String(r.symbol ?? ""),
        name: String(r.shortname ?? r.longname ?? ""),
        type: String(r.quoteType ?? ""),
        exchange: String(r.exchDisp ?? ""),
      };
    })
    .filter((s) => s.symbol);
}

/** Daily close history for stats/correlation work (scripts). */
export async function fetchDailyCloses(
  symbol: string,
  days: number,
): Promise<{ date: Date; close: number }[]> {
  const res = await yf.chart(symbol, {
    period1: new Date(Date.now() - days * 86_400_000),
    interval: "1d",
    includePrePost: false,
  });
  return (res.quotes ?? [])
    .filter((q) => q.close != null)
    .map((q) => ({ date: new Date(q.date), close: q.close as number }));
}
