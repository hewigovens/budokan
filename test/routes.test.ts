import { expect, spyOn, test } from "bun:test";
import { addDays, jstNow } from "../src/dates";
import { ARCHIVE_KEY } from "../src/events";
import { LOCALES } from "../src/i18n";
import worker from "../src/index";
import type { BudokanEvent, PublishedSnapshot, Snapshot } from "../src/types";
import { eventPath, SITE } from "../src/urls";

const shows: BudokanEvent[] = [
  { date: "2026-11-13", kind: "concert", headline: "BAND-MAID", title: "WORLD TOUR 2026 FINAL", open: "17:00", start: "18:00", end: "21:00", image: "https://example.com/band.jpg", url: "https://www.eventernote.com/events/462037", sources: [] },
  { date: "2026-11-03", kind: "budo", headline: "剣道選手権大会", organizer: "全日本剣道連盟", sport: "Kendo", sources: [] },
];

function setup(events = shows) {
  const snapshot: Snapshot = { updatedAt: "2026-10-25T00:00:00Z", sources: [], events };
  const data = new Map([["snapshot", JSON.stringify(snapshot)]]);
  const writes: string[] = [];
  const env = { EVENTS: {
    get: async (key: string) => JSON.parse(data.get(key) ?? "null"),
    put: async (key: string, value: string) => { writes.push(key); data.set(key, value); },
  } as unknown as KVNamespace };
  const get = (path: string, headers?: HeadersInit) => worker.fetch(new Request(`${SITE}${path}`, { headers }), env);
  const archive = () => JSON.parse(data.get(ARCHIVE_KEY)!) as PublishedSnapshot;
  return { data, writes, get, archive, env };
}

const schema = (html: string) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1]);

test("existing snapshots migrate once, publish records before links, and link to one-event pages", async () => {
  const app = setup();
  const html = await (await app.get("/?date=2026-11-13&lang=en")).text();
  const event = app.archive().events[0];
  expect(app.writes).toEqual([ARCHIVE_KEY, "snapshot"]);
  expect(html).toContain(`href="${eventPath(event.id)}?lang=en"`);
  expect(schema(html)["@type"]).toBe("CollectionPage");
  const response = await app.get(`${eventPath(event.id)}?lang=en`);
  expect(response.status).toBe(200);
  const detail = await response.text();
  expect(detail).toContain('<h1 lang="ja">BAND-MAID</h1>');
  expect(detail).not.toContain('<section class="upcoming">');
  expect(detail).not.toContain("剣道選手権大会");
  expect(schema(detail)).toMatchObject({
    "@type": "MusicEvent", name: "BAND-MAID WORLD TOUR 2026 FINAL",
    "@id": `${SITE}${eventPath(event.id)}#event`, url: `${SITE}${eventPath(event.id)}?lang=en`,
    startDate: "2026-11-13T18:00:00+09:00", endDate: "2026-11-13T21:00:00+09:00",
    location: { address: { addressCountry: "JP" } },
  });
  expect(schema(detail).image).toBeUndefined();
  expect(detail).not.toContain(shows[0].image!);
  expect(app.writes).toHaveLength(2);
});

test.each(LOCALES)("event URLs keep their identity, canonical and language switching in %s", async (locale) => {
  const app = setup();
  await app.get("/api/events");
  const path = eventPath(app.archive().events[0].id);
  const response = await app.get(`${path}?lang=${locale}&date=2027-01-01`);
  const html = await response.text();
  expect(response.headers.get("content-language")).toBe(locale);
  expect(html).toContain(`<link rel="canonical" href="${SITE}${path}?lang=${locale}">`);
  expect(html).toContain(`hreflang="x-default" href="${SITE}${path}"`);
  expect(schema(html).startDate).toBe("2026-11-13T18:00:00+09:00");
  for (const alternate of LOCALES.filter((l) => l !== locale)) expect(html).toContain(`href="${path}?lang=${alternate}" lang="${alternate}"`);
  const negotiated = await app.get(path, { "Accept-Language": locale });
  expect(await negotiated.text()).toContain(`<link rel="canonical" href="${SITE}${path}">`);
});

test("unknown optional facts stay absent and past URLs survive an empty current snapshot", async () => {
  const app = setup();
  await app.get("/api/events");
  const event = app.archive().events[1];
  app.data.set("snapshot", JSON.stringify({ updatedAt: "2027-01-01T00:00:00Z", events: [], sources: [] }));
  const response = await app.get(eventPath(event.id));
  expect(response.status).toBe(200);
  const data = schema(await response.text());
  expect(data).toMatchObject({ "@type": "SportsEvent", startDate: "2026-11-03", organizer: { name: "全日本剣道連盟" } });
  expect(data.description).toContain("剣道選手権大会");
  for (const key of ["offers", "endDate", "image"]) expect(data[key]).toBeUndefined();
});

test("missing events return 404, and slash redirects preserve language", async () => {
  const app = setup();
  expect((await app.get("/events/not-an-event/")).status).toBe(404);
  expect((await app.get("/events/2026-11-13-0000000000000000/")).status).toBe(404);
  await app.get("/api/events");
  const path = eventPath(app.archive().events[0].id);
  const redirect = await app.get(`${path.slice(0, -1)}?lang=ja`);
  expect(redirect.status).toBe(301);
  expect(redirect.headers.get("location")).toBe(`${SITE}${path}?lang=ja`);
});

test("the event sitemap discovers every language variant and archived event", async () => {
  const app = setup();
  const response = await app.get("/sitemap-events.xml");
  expect(response.headers.get("content-type")).toContain("application/xml");
  const xml = await response.text();
  for (const event of app.archive().events) {
    for (const locale of LOCALES) expect(xml).toContain(`<loc>${SITE}${eventPath(event.id)}?lang=${locale}</loc>`);
  }
});

test("event JSON-LD escapes source text and handles a verified end time after midnight", async () => {
  const app = setup([{ ...shows[0], headline: "</script><b>Artist", start: "23:00", end: "01:00" }]);
  await app.get("/api/events");
  const html = await (await app.get(eventPath(app.archive().events[0].id))).text();
  const data = schema(html);
  expect(data.name).toContain("</script><b>Artist");
  expect(data.endDate).toBe("2026-11-14T01:00:00+09:00");
  expect(html).not.toContain("</script><b>");
});

test("a fresh snapshot can serve an event while the archive read is stale", async () => {
  const app = setup();
  await app.get("/api/events");
  const event = app.archive().events[0];
  app.data.set(ARCHIVE_KEY, JSON.stringify({ ...app.archive(), events: [] }));
  const response = await app.get(eventPath(event.id));
  expect(response.status).toBe(200);
  expect(schema(await response.text()).name).toContain(event.headline);
});

test("single-digit source hours become valid ISO timestamps", async () => {
  const app = setup([{ ...shows[0], open: "8:00", start: "9:00", end: "10:00" }]);
  await app.get("/api/events");
  const html = await (await app.get(eventPath(app.archive().events[0].id))).text();
  expect(schema(html)).toMatchObject({
    doorTime: "2026-11-13T08:00:00+09:00",
    startDate: "2026-11-13T09:00:00+09:00",
    endDate: "2026-11-13T10:00:00+09:00",
  });
});

test("cron archives the previous snapshot before pruning past events", async () => {
  const today = jstNow().date;
  const oldDate = addDays(today, -10), future = addDays(today, 10);
  const app = setup([{ ...shows[0], date: oldDate }]);
  const fetcher = spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    if (url.includes("enjoy-live")) return new Response(`<article class="calendar" id="${future.slice(0, 7)}"><tr><th class="day">${Number(future.slice(8))}日</th><td><strong><a href="./artist.php?artist_id=future">Future artist</a></strong></td></tr></article>`);
    const date = url.includes("page=1") ? future : oldDate;
    return new Response(`<li class="clearfix"><span class="day0">${date}</span><h4><a href="/events/9001">Future artist</a></h4></li>`);
  }, { preconnect: fetch.preconnect }));
  try {
    let pending: Promise<unknown> | undefined;
    await worker.scheduled({} as ScheduledController, app.env, { waitUntil: (p: Promise<unknown>) => { pending = p; } } as ExecutionContext);
    await pending;
    const current = JSON.parse(app.data.get("snapshot")!) as Snapshot;
    expect(current.events.some((e) => e.date === oldDate)).toBe(false);
    expect(current.events.every((e) => e.id)).toBe(true);
    const old = app.archive().events.find((e) => e.date === oldDate)!;
    expect(old.id).toBeDefined();
    expect((await app.get(eventPath(old.id))).status).toBe(200);
    expect(current.sources.every((s) => s.ok)).toBe(true);
  } finally { fetcher.mockRestore(); }
});
