/**
 * Prediction markets as a forecast feed — Polymarket + Kalshi, keyless
 * public APIs, curated down to macro/finance events.
 */

export interface PredictionMarket {
  source: "Polymarket" | "Kalshi";
  question: string;
  /** Probability of the yes/first outcome, 0..1. */
  prob: number;
  volume24h: number;
  endDate: Date | null;
  url: string;
}

const MACRO = /\b(fed|rate cut|rate hike|interest rate|cpi|inflation|recession|gdp|tariff|trade deal|oil|opec|crude|gold|treasur|shutdown|debt ceiling|stimulus|unemployment|jobs report|payroll|election|china|taiwan|iran|russia|ukraine|nuclear|ceasefire|sanction|strike[s]?\b|etf|sec\b|stock|s&p|nasdaq|bitcoin|crypto)\b/i;
const NOISE = /\b(nba|nfl|mlb|nhl|ufc|soccer|football club|premier league|la liga|serie a|f1|grand prix|tennis|golf|open championship|olympic|world cup|album|song|movie|film|box office|oscar|grammy|emmy|bachelor|survivor|love island|chess|esports|league of legends)\b/i;

function macroOnly(text: string): boolean {
  return MACRO.test(text) && !NOISE.test(text);
}

async function getJSON(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "user-agent": "bloommountain/0.1 (local terminal)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.json();
}

async function fetchPolymarket(limit: number): Promise<PredictionMarket[]> {
  const raw = (await getJSON(
    "https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume24hr&ascending=false&limit=150",
  )) as Record<string, unknown>[];
  const out: PredictionMarket[] = [];
  for (const m of raw) {
    const question = String(m.question ?? "");
    if (!macroOnly(question)) continue;
    let outcomes: string[] = [];
    let prices: number[] = [];
    try {
      outcomes = JSON.parse(String(m.outcomes ?? "[]"));
      prices = (JSON.parse(String(m.outcomePrices ?? "[]")) as string[]).map(Number);
    } catch {
      continue;
    }
    // binary yes/no markets only — multi-outcome needs different display
    if (outcomes.length !== 2 || outcomes[0] !== "Yes" || !isFinite(prices[0])) continue;
    out.push({
      source: "Polymarket",
      question,
      prob: prices[0],
      volume24h: Number(m.volume24hr ?? 0),
      endDate: m.endDate ? new Date(String(m.endDate)) : null,
      url: m.slug ? `https://polymarket.com/event/${m.slug}` : "https://polymarket.com",
    });
    if (out.length >= limit) break;
  }
  return out;
}

async function fetchKalshi(limit: number): Promise<PredictionMarket[]> {
  const data = (await getJSON(
    "https://api.elections.kalshi.com/trade-api/v2/markets?limit=500&status=open",
  )) as { markets?: Record<string, unknown>[] };
  const out: PredictionMarket[] = [];
  const seen = new Set<string>();
  const markets = (data.markets ?? [])
    .filter((m) => Number(m.volume_24h ?? 0) > 0)
    .sort((a, b) => Number(b.volume_24h ?? 0) - Number(a.volume_24h ?? 0));
  for (const m of markets) {
    const title = `${m.title ?? ""} ${m.yes_sub_title ?? m.subtitle ?? ""}`.trim();
    if (!macroOnly(title) || seen.has(title)) continue;
    const last = Number(m.last_price ?? NaN); // cents
    if (!isFinite(last)) continue;
    seen.add(title);
    out.push({
      source: "Kalshi",
      question: title,
      prob: last / 100,
      volume24h: Number(m.volume_24h ?? 0),
      endDate: m.close_time ? new Date(String(m.close_time)) : null,
      url: m.ticker ? `https://kalshi.com/markets/${String(m.ticker).toLowerCase()}` : "https://kalshi.com",
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Top macro prediction markets across sources, by 24h volume. */
export async function fetchPredictions(limit = 10): Promise<PredictionMarket[]> {
  const results = await Promise.allSettled([fetchPolymarket(limit), fetchKalshi(limit)]);
  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const live = all.filter((p) => p.prob >= 0.03 && p.prob <= 0.97); // drop resolved/dead markets
  // one entry per event: near-identical questions (Fed outcome ladders) keep top volume only
  const seen = new Set<string>();
  const out: PredictionMarket[] = [];
  for (const p of live.sort((a, b) => b.volume24h - a.volume24h)) {
    const key = p.question.toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 32);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}
