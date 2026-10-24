import type { BudokanEvent } from "./types";

const UA = "Mozilla/5.0 (compatible; budokan-today/1.0)";
const ENJOY_URL = "https://schedule.enjoy-live.net/schedule.php?hall_id=3";
const EVENTERNOTE_URL = "https://www.eventernote.com/places/3/events";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", times: "×", hearts: "♥" };

export function decode(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

const pad = (n: number | string) => String(n).padStart(2, "0");

export function parseEnjoyLive(html: string): BudokanEvent[] {
  const events: BudokanEvent[] = [];
  const months = html.split(/<article class="calendar" id="/).slice(1);
  for (const block of months) {
    const [, y, m] = block.match(/^(\d{4})-(\d{1,2})"/) ?? [];
    if (!y) continue;
    for (const row of block.split(/<tr>/).slice(1)) {
      const day = row.match(/<th class="\w+">(\d{1,2})日/)?.[1];
      const cell = row.match(/<td><strong><a href="\.\/([^"]+)">([\s\S]*?)<\/a><\/strong>(?:<span>([\s\S]*?)<\/span>)?/);
      if (!day || !cell) continue;
      events.push({
        date: `${y}-${pad(m)}-${pad(day)}`,
        kind: "concert",
        headline: decode(cell[2]),
        title: cell[3] ? decode(cell[3]) : undefined,
        url: `https://schedule.enjoy-live.net/${cell[1]}`,
        sources: ["enjoy-live.net"],
      });
    }
  }
  return events;
}

export function parseEventernote(html: string): BudokanEvent[] {
  const events: BudokanEvent[] = [];
  for (const li of html.split(/<li class="clearfix[^"]*">/).slice(1)) {
    const date = li.match(/class="day\d">(\d{4}-\d{2}-\d{2})/)?.[1];
    const link = li.match(/<h4><a href="(\/events\/\d+)">([\s\S]*?)<\/a><\/h4>/);
    if (!date || !link) continue;
    const times = li.match(/開場\s*(\d{1,2}:\d{2})?\s*開演\s*(\d{1,2}:\d{2})?\s*(?:終演\s*(\d{1,2}:\d{2}))?/);
    const actorBlock = li.match(/<div class="actor">([\s\S]*?)<\/div>/)?.[1] ?? "";
    const actors = [...actorBlock.matchAll(/<a href="\/actors\/[^"]*">([\s\S]*?)<\/a>/g)].map((a) => decode(a[1]));
    const title = decode(link[2]);
    events.push({
      date,
      kind: "concert",
      headline: actors.length ? actors.slice(0, 3).join("、") + (actors.length > 3 ? " ほか" : "") : title,
      title,
      open: times?.[1],
      start: times?.[2],
      end: times?.[3],
      url: `https://www.eventernote.com${link[1]}`,
      sources: ["eventernote.com"],
    });
  }
  return events;
}

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ja" } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

export async function fetchEnjoyLive(): Promise<BudokanEvent[]> {
  return parseEnjoyLive(await get(ENJOY_URL));
}

// Eventernote lists newest-first; keep paging until we reach the past.
export async function fetchEventernote(today: string, maxPages = 5): Promise<BudokanEvent[]> {
  const all: BudokanEvent[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = parseEventernote(await get(`${EVENTERNOTE_URL}?page=${page}`));
    all.push(...batch);
    if (!batch.length || batch[batch.length - 1].date < today) break;
  }
  const upcoming = all.filter((e) => e.date >= today);
  return upcoming;
}
