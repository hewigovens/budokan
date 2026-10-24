import { budoEvents } from "./budo";
import { addDays, jstNow } from "./dates";
import { checkHealth } from "./health";
import { ARCHIVE_KEY, isPublished, publishEvents } from "./events";
import { isLocale, pickLocale } from "./i18n";
import { mergeEvents } from "./merge";
import { renderPage } from "./render";
import { fetchEnjoyLive, fetchEventernote } from "./scrape";
import { eventSitemap } from "./sitemap";
import type { BudokanEvent, PublishedSnapshot, Snapshot, SourceStatus } from "./types";

interface Env {
  EVENTS: KVNamespace;
}

const KEY = "snapshot";
async function save(env: Env, snapshot: Snapshot, previous?: Snapshot): Promise<PublishedSnapshot> {
  const stored = await env.EVENTS.get<PublishedSnapshot>(ARCHIVE_KEY, "json");
  // Archive previous records before pruning the rolling feed.
  const history = await publishEvents(previous?.events ?? [], stored?.events ?? []);
  const published = await publishEvents(snapshot.events, history.archive);
  const next = { ...snapshot, events: published.events };
  // Store records before publishing their links in the rolling snapshot.
  await env.EVENTS.put(ARCHIVE_KEY, JSON.stringify({ ...snapshot, events: published.archive }));
  await env.EVENTS.put(KEY, JSON.stringify(next));
  return next;
}

async function refresh(env: Env): Promise<PublishedSnapshot> {
  const today = jstNow().date;
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

  // If both scrapers fail, keep serving the previous concerts rather than wiping them.
  let concerts = [enjoy.events, eventernote.events];
  if (!enjoy.events.length && !eventernote.events.length) concerts = [prev?.events.filter((e) => e.kind === "concert") ?? []];

  const sources = [enjoy.status, eventernote.status];
  const snapshot: Snapshot = {
    updatedAt: checkedAt,
    events: mergeEvents(budoEvents(), ...concerts).filter((e) => e.date >= addDays(today, -1)),
    sources,
  };
  const published = await save(env, snapshot, prev ?? undefined);
  console.log(JSON.stringify({ msg: "refreshed", events: snapshot.events.length, sources: sources.map((s) => `${s.name}=${s.ok ? s.count : "FAIL"}`) }));
  return published;
}

async function load(env: Env): Promise<PublishedSnapshot> {
  const snap = await env.EVENTS.get<Snapshot>(KEY, "json");
  // Legacy snapshots without source status need a fresh scrape.
  if (!snap?.sources) return refresh(env);
  return isPublished(snap) ? snap : save(env, snap);
}

async function loadArchive(env: Env): Promise<PublishedSnapshot> {
  const archive = await env.EVENTS.get<PublishedSnapshot>(ARCHIVE_KEY, "json");
  if (archive) return archive;
  const snapshot = await load(env);
  return await env.EVENTS.get<PublishedSnapshot>(ARCHIVE_KEY, "json") ?? snapshot;
}

export default {
  async fetch(req, env): Promise<Response> {
    const url = new URL(req.url);
    const eventRoute = url.pathname.match(/^\/events\/(\d{4}-\d{2}-\d{2}-[a-f0-9]{16})(\/?)$/);
    if (eventRoute && !eventRoute[2]) {
      url.pathname += "/";
      return Response.redirect(url.href, 301);
    }
    if (url.pathname === "/" || eventRoute) {
      const now = jstNow();
      const asked = url.searchParams.get("date");
      const date = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : now.date;
      const langParam = url.searchParams.get("lang");
      const locale = pickLocale(langParam, req.headers.get("cookie"), req.headers.get("accept-language"));
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
      return new Response(renderPage(snap, { date: event?.date ?? date, now, locale, langInUrl: isLocale(langParam), health, event }), { headers });
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

