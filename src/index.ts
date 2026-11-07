import { budoEvents } from "./budo";
import { addDays, inDateWindow, isDate, jstNow } from "./dates";
import { checkHealth, isIncomplete } from "./health";
import { ARCHIVE_KEY, eventernoteIds, isPublished, publishEvents } from "./events";
import { isLocale, pickLocale } from "./i18n";
import { mergeEvents } from "./merge";
import { renderPage } from "./render";
import { fetchEnjoyLive, fetchEventernote } from "./scrape";
import { eventSitemap } from "./sitemap";
import type { BudokanEvent, PublishedSnapshot, Snapshot, SourceStatus } from "./types";
import { eventPath } from "./urls";

interface Env {
  EVENTS: KVNamespace;
}

// Host names recorded in an event's `sources`, keyed by the scraper's status name.
const SOURCE_HOSTS: Record<string, string> = { "enjoy-live": "enjoy-live.net", eventernote: "eventernote.com" };

const KEY = "snapshot";
// KV bills every get, including edge-cached ones, so page requests share one read per key per isolate per minute.
const MEMO_MS = 60_000;
const memos = new WeakMap<KVNamespace, Map<string, { value: unknown; until: number }>>();

function memo(kv: KVNamespace) {
  let entries = memos.get(kv);
  if (!entries) memos.set(kv, entries = new Map());
  return entries;
}

async function cachedGet<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const hit = memo(kv).get(key);
  if (hit && hit.until > Date.now()) return hit.value as T;
  const value = await kv.get<T>(key, "json");
  if (value) memo(kv).set(key, { value, until: Date.now() + MEMO_MS });
  return value;
}

async function put(kv: KVNamespace, key: string, value: unknown) {
  await kv.put(key, JSON.stringify(value));
  memo(kv).set(key, { value, until: Date.now() + MEMO_MS });
}

async function save(env: Env, snapshot: Snapshot, previous?: Snapshot): Promise<PublishedSnapshot> {
  const stored = await env.EVENTS.get<PublishedSnapshot>(ARCHIVE_KEY, "json");
  // Archive previous records before pruning the rolling feed.
  const history = await publishEvents(previous?.events ?? [], stored?.events ?? []);
  const published = await publishEvents(snapshot.events, history.archive);
  const next = { ...snapshot, events: published.events };
  // Store records before publishing their links in the rolling snapshot.
  await put(env.EVENTS, ARCHIVE_KEY, { ...snapshot, events: published.archive });
  await put(env.EVENTS, KEY, next);
  return next;
}

async function refresh(env: Env): Promise<PublishedSnapshot> {
  const today = jstNow().date;
  const earliest = addDays(today, -1);
  const checkedAt = new Date().toISOString();
  const prev = await env.EVENTS.get<Snapshot>(KEY, "json");

  // A layout change can silently parse zero events; treat it as a source failure.
  const run = async (name: string, fetcher: () => Promise<BudokanEvent[]>) => {
    try {
      const events = await fetcher();
      if (!events.length) throw new Error("parsed 0 events; the page layout may have changed");
      const status: SourceStatus = { name, ok: true, count: events.length, checkedAt, lastSuccessAt: checkedAt };
      return { events, status };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      console.error(JSON.stringify({ msg: "source failed", source: name, error }));
      const lastSuccessAt = prev?.sources?.find((s) => s.name === name)?.lastSuccessAt;
      const status: SourceStatus = { name, ok: false, count: 0, error, checkedAt, lastSuccessAt };
      return { events: [] as BudokanEvent[], status };
    }
  };

  const [enjoy, eventernote] = await Promise.all([run("enjoy-live", fetchEnjoyLive), run("eventernote", () => fetchEventernote(today))]);
  const results = [enjoy, eventernote];

  // A failing source must not erase its listings: carry its last published records forward, still
  // in source-priority order, so its concert days do not silently become empty days. The previous
  // snapshot is the newest copy; the archive recovers records an earlier failed run already dropped.
  if (results.some((r) => !r.status.ok)) {
    const archive = (await env.EVENTS.get<PublishedSnapshot>(ARCHIVE_KEY, "json"))?.events ?? [];
    // A healthy Eventernote listing is authoritative for the show it identifies. A carried copy of a
    // rescheduled show would leave a phantom date, and its stale times (merged first) would override
    // fresh ones. Without a fresh counterpart, the carried copy keeps its last known times.
    const fresh = new Map(results.filter((r) => r.status.ok).flatMap((r) => r.events.flatMap((e) => eventernoteIds(e).map((id) => [id, e.date] as const))));
    const carry = (events: BudokanEvent[]) => events.flatMap((e): BudokanEvent[] => {
      const dates = eventernoteIds(e).flatMap((id) => fresh.get(id) ?? []);
      if (dates.some((d) => d !== e.date)) return [];
      return dates.length ? [{ ...e, open: undefined, start: undefined, end: undefined, image: undefined }] : [e];
    });
    for (const r of results) {
      if (r.status.ok) continue;
      const host = SOURCE_HOSTS[r.status.name];
      const fromPrev = (prev?.events ?? []).filter((e) => e.kind === "concert" && e.date >= earliest && e.sources.includes(host));
      r.events = carry(fromPrev.length ? fromPrev : archive.filter((e) => e.kind === "concert" && e.date >= earliest && e.sources.includes(host)));
      r.status.retained = r.events.length > 0;
    }
    console.log(JSON.stringify({ msg: "carried listings for failed sources", sources: results.filter((r) => !r.status.ok).map((r) => `${r.status.name}=${r.status.retained ? r.events.length : "none"}`) }));
  }

  const sources = results.map((r) => r.status);
  const snapshot: Snapshot = {
    updatedAt: checkedAt,
    events: mergeEvents(budoEvents(), ...results.map((r) => r.events)).filter((e) => e.date >= earliest),
    sources,
  };
  const published = await save(env, snapshot, prev ?? undefined);
  console.log(JSON.stringify({ msg: "refreshed", events: snapshot.events.length, sources: sources.map((s) => `${s.name}=${s.ok ? s.count : s.retained ? "CARRIED" : "FAIL"}`) }));
  return published;
}

async function load(env: Env): Promise<PublishedSnapshot> {
  const snap = await cachedGet<Snapshot>(env.EVENTS, KEY);
  // Legacy snapshots without source status need a fresh scrape.
  if (!snap?.sources) return refresh(env);
  return isPublished(snap) ? snap : save(env, snap);
}

async function loadArchive(env: Env): Promise<PublishedSnapshot> {
  const archive = await cachedGet<PublishedSnapshot>(env.EVENTS, ARCHIVE_KEY);
  if (archive) return archive;
  const snapshot = await load(env);
  return await cachedGet<PublishedSnapshot>(env.EVENTS, ARCHIVE_KEY) ?? snapshot;
}

export default {
  async fetch(req, env): Promise<Response> {
    const url = new URL(req.url);
    const eventRoute = url.pathname.match(/^\/events\/(\d{4}-\d{2}-\d{2}-[a-f0-9]{16})\/?$/);
    if (url.pathname === "/" || eventRoute) {
      const now = jstNow();
      const asked = url.searchParams.get("date");
      const date = !eventRoute && isDate(asked) ? asked : undefined;
      if (date && !inDateWindow(date, now.date)) return new Response("Date out of range", { status: 404, headers: { "x-robots-tag": "noindex" } });
      const langParam = url.searchParams.get("lang");
      const locale = pickLocale(langParam, req.headers.get("cookie"), req.headers.get("accept-language"));
      const path = eventRoute ? eventPath(eventRoute[1]) : "/";
      const params = new URLSearchParams();
      if (isLocale(langParam)) params.set("lang", langParam);
      if (date) params.set("date", date);
      const normalized = `${path}${params.size ? `?${params}` : ""}`;
      // Drop duplicate/irrelevant parameters and normalize slash/order in one hop.
      if (url.pathname + url.search !== normalized) return Response.redirect(new URL(normalized, url).href, 301);
      const headers = new Headers({
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, max-age=300",
        "content-language": locale,
        vary: "Accept-Language, Cookie",
      });
      // Remember an explicit language choice so day navigation keeps it.
      if (isLocale(langParam)) headers.append("set-cookie", `lang=${langParam}; Path=/; Max-Age=31536000; SameSite=Lax`);
      let snap = eventRoute ? await loadArchive(env) : await load(env);
      let event = eventRoute ? snap.events.find((e) => e.id === eventRoute[1]) : undefined;
      // KV keys can propagate at different times; a fresh schedule can precede the archive.
      if (eventRoute && !event) {
        snap = await load(env);
        event = snap.events.find((e) => e.id === eventRoute[1]);
      }
      if (eventRoute && !event) return new Response("Event not found", { status: 404 });
      const health = checkHealth(snap, Date.now(), now.date).status;
      return new Response(renderPage(snap, { date: event?.date ?? date, now, locale, health, incomplete: !event && isIncomplete(snap), event }), { headers });
    }
    switch (url.pathname) {
      case "/sitemap-events.xml":
        return new Response(eventSitemap((await loadArchive(env)).events), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" } });
      case "/health": {
        const health = checkHealth(await load(env), Date.now(), jstNow().date);
        return Response.json({ status: health.status, updatedAt: health.updatedAt }, { status: health.status === "error" ? 503 : 200, headers: { "cache-control": "no-store" } });
      }
      case "/api/events": {
        const snap = await load(env);
        // Public data is deliberate; internal diagnostics and unlicensed images are not.
        const events = snap.events.map(({ date, kind, headline, title, sport, organizer, open, start, end, url, sources }) =>
          ({ date, kind, headline, title, sport, organizer, open, start, end, url, sources }));
        return Response.json({ updatedAt: snap.updatedAt, events }, { headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=300" } });
      }
      default:
        return new Response("Not found", { status: 404 });
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(refresh(env));
  },
} satisfies ExportedHandler<Env>;

