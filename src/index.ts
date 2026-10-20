import { budoEvents } from "./budo";
import { addDays, jstNow } from "./dates";
import { checkHealth } from "./health";
import { isLocale, pickLocale } from "./i18n";
import { mergeEvents } from "./merge";
import { renderPage } from "./render";
import { fetchEnjoyLive, fetchEventernote } from "./scrape";
import type { BudokanEvent, Snapshot, SourceStatus } from "./types";

interface Env {
  EVENTS: KVNamespace;
}

const KEY = "snapshot";

async function refresh(env: Env): Promise<Snapshot> {
  const today = jstNow().date;
  const checkedAt = new Date().toISOString();
  const prev = await env.EVENTS.get<Snapshot>(KEY, "json");

  // Each source records its own status. Zero events counts as a failure: when a site changes
  // its HTML the parser silently matches nothing rather than throwing.
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
  await env.EVENTS.put(KEY, JSON.stringify(snapshot));
  console.log(JSON.stringify({ msg: "refreshed", events: snapshot.events.length, sources: sources.map((s) => `${s.name}=${s.ok ? s.count : "FAIL"}`) }));
  return snapshot;
}

// Refresh inline when KV is empty or holds a snapshot from before per-source status existed.
async function load(env: Env): Promise<Snapshot> {
  const snap = await env.EVENTS.get<Snapshot>(KEY, "json");
  return snap?.sources ? snap : refresh(env);
}

export default {
  async fetch(req, env): Promise<Response> {
    const url = new URL(req.url);
    switch (url.pathname) {
      case "/": {
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
        const snap = await load(env);
        const health = checkHealth(snap, Date.now(), now.date).status;
        return new Response(renderPage(snap, { date, now, locale, langInUrl: isLocale(langParam), health }), { headers });
      }
      case "/health": {
        const health = checkHealth(await load(env), Date.now(), jstNow().date);
        return Response.json(health, { status: health.status === "error" ? 503 : 200, headers: { "cache-control": "no-store" } });
      }
      case "/api/events":
        return Response.json(await load(env), { headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=300" } });
      default:
        return new Response("Not found", { status: 404 });
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(refresh(env));
  },
} satisfies ExportedHandler<Env>;
