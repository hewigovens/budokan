import type { BudokanEvent, PublishedEvent, PublishedSnapshot, Snapshot } from "./types";

export const ARCHIVE_KEY = "event-archive";
export const eventUrls = (event: BudokanEvent) => [...new Set([...(event.sourceUrls ?? []), event.url].filter((url): url is string => !!url))];
export const eventSubtitle = (event: BudokanEvent) => event.title && event.title !== event.headline ? event.title : "";
export const eventName = (event: BudokanEvent) => [event.headline, eventSubtitle(event)].filter(Boolean).join(" ");

const norm = (text = "") => text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const eventernoteIds = (event: BudokanEvent) => eventUrls(event).flatMap((url) => url.match(/^https:\/\/(?:www\.)?eventernote\.com\/events\/(\d+)\/?$/)?.[1] ?? []);
const sameSlot = (a: BudokanEvent, b: BudokanEvent) => a.date === b.date && (!a.start || !b.start || a.start === b.start);

function sourceMatch(a: BudokanEvent, b: BudokanEvent): boolean | undefined {
  const ai = eventernoteIds(a), bi = eventernoteIds(b);
  // Distinct Eventernote IDs distinguish matinee/evening shows; a shared ID survives rescheduling.
  return ai.length && bi.length ? ai.some((id) => bi.includes(id)) : undefined;
}

function similarNames(a: BudokanEvent, b: BudokanEvent): boolean {
  const ah = norm(a.headline), bh = norm(b.headline);
  const at = norm(a.title), bt = norm(b.title);
  return (
    (ah.length > 1 && (bh + bt).includes(ah)) ||
    (bh.length > 1 && (ah + at).includes(bh)) ||
    // Artist spellings can differ (ヒメヒナ vs HIMEHINA) while tour names overlap.
    (at.length > 6 && bt.length > 6 && (at.includes(bt) || bt.includes(at)))
  );
}

export function sameShow(a: BudokanEvent, b: BudokanEvent): boolean {
  if (a.kind !== b.kind || a.date !== b.date) return false;
  return sourceMatch(a, b) ?? (sameSlot(a, b) && similarNames(a, b));
}

function matches(a: BudokanEvent, b: BudokanEvent): boolean {
  if (a.kind !== b.kind) return false;
  const known = sourceMatch(a, b);
  if (known !== undefined) return known;
  const au = eventUrls(a), bu = eventUrls(b);
  // enjoy-live URLs identify an artist, so only reuse them within the same performance slot.
  const sameArtist = au.some((url) => /^https:\/\/schedule\.enjoy-live\.net\/artist\.php\?/.test(url) && bu.includes(url));
  return sameSlot(a, b) && (sameArtist || similarNames(a, b));
}

export function isPublished(snapshot: Snapshot): snapshot is PublishedSnapshot {
  return snapshot.events.every((event) => !!event.id);
}

async function initialId(event: BudokanEvent): Promise<string> {
  // Deterministic on first publication so concurrent migrations of the same snapshot agree.
  const key = JSON.stringify([event.date, event.kind, event.headline.normalize("NFKC"), event.title ?? "", event.start ?? "", eventUrls(event).sort()]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
  return `${event.date}-${hash}`;
}

export async function publishEvents(current: BudokanEvent[], history: PublishedEvent[]) {
  const archive = new Map(history.map((e) => [e.id, e]));
  const used = new Set<string>();
  const events: PublishedEvent[] = [];
  for (const event of current) {
    const previous = (event.id && archive.get(event.id)) || [...archive.values()].find((old) => !used.has(old.id) && matches(event, old));
    const id = previous?.id ?? event.id ?? await initialId(event);
    const published = { ...event, id, sourceUrls: [...new Set([...eventUrls(previous ?? event), ...eventUrls(event)])] };
    archive.set(id, published);
    used.add(id);
    events.push(published);
  }
  return { events, archive: [...archive.values()] };
}
