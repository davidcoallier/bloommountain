/** Futures board: grouped contracts + the fed-funds implied rate, via Yahoo. */
import { fetchQuotes, type Quote } from "./yahoo.js";

export interface BoardGroup {
  group: string;
  entries: { label: string; quote: Quote }[];
}

const BOARD: [string, [string, string][]][] = [
  ["ENERGY", [["CL=F", "WTI"], ["BZ=F", "Brent"], ["NG=F", "NatGas"], ["RB=F", "Gasoline"]]],
  ["METALS", [["GC=F", "Gold"], ["SI=F", "Silver"], ["HG=F", "Copper"], ["PL=F", "Platinum"]]],
  ["AGS", [["ZC=F", "Corn"], ["ZW=F", "Wheat"], ["ZS=F", "Soybeans"], ["KC=F", "Coffee"], ["CC=F", "Cocoa"]]],
  ["INDICES", [["ES=F", "S&P"], ["NQ=F", "Nasdaq"], ["YM=F", "Dow"], ["RTY=F", "Russell"]]],
  ["RATES", [["ZQ=F", "FedFunds"], ["ZN=F", "10Y Note"], ["ZB=F", "30Y Bond"]]],
];

export interface FuturesBoard {
  groups: BoardGroup[];
  /** 100 − ZQ front price = market-implied average fed funds rate (%). */
  impliedFedRate: number | null;
}

export async function fetchFuturesBoard(): Promise<FuturesBoard> {
  const symbols = BOARD.flatMap(([, entries]) => entries.map(([s]) => s));
  const quotes = await fetchQuotes(symbols);
  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
  const groups: BoardGroup[] = BOARD.map(([group, entries]) => ({
    group,
    entries: entries
      .map(([symbol, label]) => ({ label, quote: bySymbol.get(symbol) }))
      .filter((e): e is { label: string; quote: Quote } => e.quote?.price != null),
  }));
  const zq = bySymbol.get("ZQ=F")?.price ?? null;
  return { groups, impliedFedRate: zq != null ? 100 - zq : null };
}
