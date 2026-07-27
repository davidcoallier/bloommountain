/** Options-chain math shared by the options-analyst and earnings-scout scripts. */
import { yf } from "../../src/lib/yahoo.js";

export interface OptionRow {
  strike: number;
  bid?: number;
  ask?: number;
  lastPrice?: number;
  impliedVolatility?: number;
  openInterest?: number;
  volume?: number;
}

export interface ChainSummary {
  expiry: Date;
  spot: number;
  atmStrike: number;
  atmIV: number | null;
  /** Straddle-implied move by expiry, as a fraction of spot. */
  impliedMovePct: number | null;
  putCallVolume: number | null;
  putCallOI: number | null;
  topCallOI: { strike: number; oi: number }[];
  topPutOI: { strike: number; oi: number }[];
  unusual: { type: "call" | "put"; strike: number; volume: number; oi: number }[];
}

function mid(r: OptionRow): number | null {
  if (r.bid && r.ask && r.ask >= r.bid) return (r.bid + r.ask) / 2;
  return r.lastPrice ?? null;
}

/** Summarize the chain at one expiry (0 = nearest, or pass a min date). */
export async function chainSummary(symbol: string, after?: Date): Promise<ChainSummary> {
  const base = (await yf.options(symbol)) as unknown as {
    expirationDates: Date[];
    quote: { regularMarketPrice: number };
    options: { expirationDate: Date; calls: OptionRow[]; puts: OptionRow[] }[];
  };
  const spot = base.quote.regularMarketPrice;
  const expiries = base.expirationDates ?? [];
  const target =
    (after ? expiries.find((e) => e.getTime() >= after.getTime()) : expiries[0]) ?? expiries[0];
  if (!target) throw new Error(`no listed options for ${symbol}`);

  // fetch the specific expiry (base response carries only the nearest)
  const chain =
    base.options[0]?.expirationDate?.getTime() === target.getTime()
      ? base.options[0]
      : ((await yf.options(symbol, { date: target } as never)) as unknown as {
          options: { calls: OptionRow[]; puts: OptionRow[] }[];
        }).options[0];

  const calls = chain?.calls ?? [];
  const puts = chain?.puts ?? [];
  const atm = (rows: OptionRow[]) =>
    rows.reduce<OptionRow | null>(
      (best, r) => (best == null || Math.abs(r.strike - spot) < Math.abs(best.strike - spot) ? r : best),
      null,
    );
  const atmCall = atm(calls);
  const atmPut = atm(puts);
  const cm = atmCall ? mid(atmCall) : null;
  const pm = atmPut ? mid(atmPut) : null;
  const straddle = cm != null && pm != null ? cm + pm : null;

  const sum = (rows: OptionRow[], f: (r: OptionRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  const callVol = sum(calls, (r) => r.volume ?? 0);
  const putVol = sum(puts, (r) => r.volume ?? 0);
  const callOI = sum(calls, (r) => r.openInterest ?? 0);
  const putOI = sum(puts, (r) => r.openInterest ?? 0);

  const walls = (rows: OptionRow[]) =>
    rows
      .filter((r) => r.openInterest)
      .sort((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0))
      .slice(0, 3)
      .map((r) => ({ strike: r.strike, oi: r.openInterest ?? 0 }));

  const unusual = ([...calls.map((r) => ({ r, type: "call" as const })), ...puts.map((r) => ({ r, type: "put" as const }))]
    .filter(({ r }) => (r.volume ?? 0) > 500 && (r.volume ?? 0) > 3 * Math.max(1, r.openInterest ?? 0))
    .sort((a, b) => (b.r.volume ?? 0) - (a.r.volume ?? 0))
    .slice(0, 5))
    .map(({ r, type }) => ({ type, strike: r.strike, volume: r.volume ?? 0, oi: r.openInterest ?? 0 }));

  return {
    expiry: target,
    spot,
    atmStrike: atmCall?.strike ?? spot,
    atmIV: atmCall?.impliedVolatility && atmCall.impliedVolatility > 0.01 ? atmCall.impliedVolatility : null,
    impliedMovePct: straddle != null && spot ? straddle / spot : null,
    putCallVolume: callVol ? putVol / callVol : null,
    putCallOI: callOI ? putOI / callOI : null,
    topCallOI: walls(calls),
    topPutOI: walls(puts),
    unusual,
  };
}
