/**
 * Multi-source news wire for the futures desk — free RSS feeds beyond Yahoo,
 * merged, deduped, and tagged by commodity/theme. No parser dependency:
 * RSS <item> extraction is regex-based on purpose.
 */

export interface WireItem {
  title: string;
  source: string;
  published: Date | null;
  link: string;
  tags: string[];
}

const FEEDS: [string, string][] = [
  ["OilPrice", "https://oilprice.com/rss/main"],
  ["CNBC", "https://www.cnbc.com/id/19836768/device/rss/rss.html"],
  ["MarketWatch", "https://feeds.content.dowjones.io/public/rss/mw_topstories"],
];

/** personal-finance / lifestyle columns that aren't desk-relevant */
const LIFESTYLE = /\b(my (adviser|wife|husband|mother|father|brother|sister)|inherited|i'm \d+|retire|social security|mansion|malibu|home for sale|net worth|dear\b)/i;

const TAGS: [string, RegExp][] = [
  ["oil", /\b(oil|crude|wti|brent|opec|barrel)\b/i],
  ["gas", /\b(natural gas|lng|natgas)\b/i],
  ["gold", /\b(gold|bullion|silver)\b/i],
  ["metals", /\b(copper|platinum|palladium|lithium|nickel)\b/i],
  ["ags", /\b(corn|wheat|soybean|coffee|cocoa|sugar|grain)\b/i],
  ["fed", /\b(fed|fomc|powell|rate cut|rate hike|interest rate|treasury|yield)\b/i],
  ["macro", /\b(cpi|inflation|gdp|recession|tariff|jobs report|payroll|unemployment)\b/i],
  ["fx", /\b(dollar|euro|yen|currency)\b/i],
  ["crypto", /\b(bitcoin|crypto|ethereum)\b/i],
];

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#x27;/g, "'")
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#821[12];/g, "–")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function parseFeed(xml: string, source: string): WireItem[] {
  const items: WireItem[] = [];
  for (const m of xml.matchAll(/<item[\s>](.*?)<\/item>/gs)) {
    const block = m[1];
    const title = decode(block.match(/<title[^>]*>(.*?)<\/title>/s)?.[1] ?? "");
    if (!title || LIFESTYLE.test(title)) continue;
    const link = decode(block.match(/<link[^>]*>(.*?)<\/link>/s)?.[1] ?? "");
    const pub = block.match(/<pubDate[^>]*>(.*?)<\/pubDate>/s)?.[1];
    const published = pub ? new Date(pub.trim()) : null;
    const tags = TAGS.filter(([, re]) => re.test(title)).map(([t]) => t);
    items.push({ title, source, published: published && !isNaN(+published) ? published : null, link, tags });
  }
  return items;
}

/** Merged wire across all feeds, newest first, deduped by title. */
export async function fetchWire(limit = 30): Promise<WireItem[]> {
  const results = await Promise.allSettled(
    FEEDS.map(async ([source, url]) => {
      const res = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0 (bloommountain local terminal)" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return parseFeed(await res.text(), source);
    }),
  );
  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const seen = new Set<string>();
  const merged: WireItem[] = [];
  // tagged (commodity/macro) stories first, each newest-first
  const ordered = all.sort((a, b) => {
    const t = (b.tags.length ? 1 : 0) - (a.tags.length ? 1 : 0);
    return t !== 0 ? t : (b.published?.getTime() ?? 0) - (a.published?.getTime() ?? 0);
  });
  for (const item of ordered) {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= limit) break;
  }
  return merged;
}
