import { afterAll, beforeAll, expect, setSystemTime, spyOn, test } from "bun:test";
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
  const reads: string[] = [];
  // Each namespace object stands for one isolate, which memoizes its own reads.
  const namespace = () => ({ EVENTS: {
    get: async (key: string) => { reads.push(key); return JSON.parse(data.get(key) ?? "null"); },
    put: async (key: string, value: string) => { writes.push(key); data.set(key, value); },
  } as unknown as KVNamespace });
  let env = namespace();
  const get = (path: string, headers?: HeadersInit) => worker.fetch(new Request(`${SITE}${path}`, { headers }), env);
  const isolate = () => { env = namespace(); };
  const archive = () => JSON.parse(data.get(ARCHIVE_KEY)!) as PublishedSnapshot;
  return { data, writes, reads, get, isolate, archive, get env() { return env; } };
}

// Fixture dates must stay inside the calendar's rolling date window.
beforeAll(() => setSystemTime(new Date("2026-11-06T03:00:00Z")));
afterAll(() => setSystemTime());

const schema = (html: string) => JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1]);

test("existing snapshots migrate once, publish records before links, and link to one-event pages", async () => {
  const app = setup();
  const html = await (await app.get("/?lang=en&date=2026-11-13")).text();
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
  const response = await app.get(`${path}?lang=${locale}`);
  const html = await response.text();
  expect(response.headers.get("content-language")).toBe(locale);
  expect(html).toContain(`<link rel="canonical" href="${SITE}${path}?lang=${locale}">`);
  expect(html).toContain(`hreflang="x-default" href="${SITE}${path}"`);
  expect(schema(html).startDate).toBe("2026-11-13T18:00:00+09:00");
  for (const alternate of LOCALES.filter((l) => l !== locale)) expect(html).toContain(`href="${path}?lang=${alternate}" lang="${alternate}"`);
  const negotiated = await app.get(path, { "Accept-Language": locale });
  expect(await negotiated.text()).toContain(`<link rel="canonical" href="${SITE}${path}?lang=${locale}">`);
});

test("unknown optional facts stay absent and past URLs survive an empty current snapshot", async () => {
  const app = setup();
  await app.get("/api/events");
  const event = app.archive().events[1];
  app.data.set("snapshot", JSON.stringify({ updatedAt: "2027-01-01T00:00:00Z", events: [], sources: [] }));
  app.isolate();
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
  app.isolate();
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

test("a carried record takes today's times from the healthy source, not its stale merged copy", async () => {
  const showDate = addDays(jstNow().date, 10);
  const app = setup([{ ...shows[0], date: showDate, headline: "Future artist", open: "17:00", start: "18:00", url: "https://www.eventernote.com/events/9001", sources: ["enjoy-live.net", "eventernote.com"] }]);
  const fetcher = spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    if (url.includes("enjoy-live")) return new Response("challenge", { status: 403 });
    return new Response(`<li class="clearfix"><span class="day0">${showDate}</span><h4><a href="/events/9001">Future artist</a></h4>開場 16:00 開演 17:00</li>`);
  }, { preconnect: fetch.preconnect }));
  try {
    let pending: Promise<unknown> | undefined;
    await worker.scheduled({} as ScheduledController, app.env, { waitUntil: (p: Promise<unknown>) => { pending = p; } } as ExecutionContext);
    await pending;
    const shows = (JSON.parse(app.data.get("snapshot")!) as Snapshot).events.filter((e) => e.date === showDate);
    expect(shows).toHaveLength(1);
    expect(shows[0]).toMatchObject({ headline: "Future artist", open: "16:00", start: "17:00" });
  } finally { fetcher.mockRestore(); }
});

async function cron(app: ReturnType<typeof setup>, respond: (url: string) => Response) {
  const fetcher = spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (input: Parameters<typeof fetch>[0]) => respond(String(input)), { preconnect: fetch.preconnect }));
  try {
    let pending: Promise<unknown> | undefined;
    await worker.scheduled({} as ScheduledController, app.env, { waitUntil: (p: Promise<unknown>) => { pending = p; } } as ExecutionContext);
    await pending;
    return JSON.parse(app.data.get("snapshot")!) as Snapshot;
  } finally { fetcher.mockRestore(); }
}

test("an Eventernote outage keeps the last known times of carried shows", async () => {
  const showDate = addDays(jstNow().date, 10);
  const app = setup([{ ...shows[0], date: showDate, headline: "Future artist", open: "17:00", start: "18:00", url: "https://www.eventernote.com/events/9001", sourceUrls: ["https://schedule.enjoy-live.net/artist.php?artist_id=future"], sources: ["enjoy-live.net", "eventernote.com"] }]);
  const current = await cron(app, (url) => url.includes("enjoy-live")
    ? new Response(`<article class="calendar" id="${showDate.slice(0, 7)}"><tr><th class="day">${Number(showDate.slice(8))}日</th><td><strong><a href="./artist.php?artist_id=future">Future artist</a></strong></td></tr></article>`)
    : new Response("unavailable", { status: 503 }));
  const kept = current.events.filter((e) => e.date === showDate);
  expect(kept).toHaveLength(1);
  expect(kept[0]).toMatchObject({ open: "17:00", start: "18:00" });
});

test("a show rescheduled on the healthy source leaves no carried copy on its old date", async () => {
  const today = jstNow().date;
  const oldDate = addDays(today, 10), newDate = addDays(today, 20);
  const app = setup([{ ...shows[0], date: oldDate, headline: "Future artist", start: "18:00", url: "https://www.eventernote.com/events/9001", sources: ["enjoy-live.net", "eventernote.com"] }]);
  const current = await cron(app, (url) => url.includes("enjoy-live")
    ? new Response("challenge", { status: 403 })
    : new Response(`<li class="clearfix"><span class="day0">${newDate}</span><h4><a href="/events/9001">Future artist</a></h4>開場 17:00 開演 18:00</li>`));
  expect(current.events.some((e) => e.date === oldDate)).toBe(false);
  const moved = current.events.find((e) => e.date === newDate)!;
  // The previously published record keeps its ID (and event URL) and follows the new date.
  const records = app.archive().events.filter((e) => e.url === "https://www.eventernote.com/events/9001");
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({ id: moved.id, date: newDate });
  expect(moved.id).toStartWith(oldDate);
});

test("a failing source keeps its published concerts instead of emptying their days", async () => {
  const today = jstNow().date;
  const showDate = addDays(today, 3);
  // Previous refresh published an enjoy-live-only show; enjoy-live now answers 403.
  const app = setup([
    { ...shows[0], date: showDate, headline: "Sold Out Artist", title: "10th Anniversary", start: "18:00", url: "https://schedule.enjoy-live.net/artist.php?artist_id=soldout", sources: ["enjoy-live.net"] },
  ]);
  const fetcher = spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (input: Parameters<typeof fetch>[0]) => {
    if (String(input).includes("enjoy-live")) return new Response("challenge", { status: 403, headers: { "cf-mitigated": "challenge" } });
    return new Response(`<li class="clearfix"><span class="day0">${addDays(today, 4)}</span><h4><a href="/events/9100">Another artist</a></h4></li>`);
  }, { preconnect: fetch.preconnect }));
  try {
    let pending: Promise<unknown> | undefined;
    await worker.scheduled({} as ScheduledController, app.env, { waitUntil: (p: Promise<unknown>) => { pending = p; } } as ExecutionContext);
    await pending;
    const current = JSON.parse(app.data.get("snapshot")!) as Snapshot;
    const kept = current.events.find((e) => e.date === showDate);
    expect(kept?.headline).toBe("Sold Out Artist");
    expect(kept?.title).toBe("10th Anniversary");
    const enjoy = current.sources.find((s) => s.name === "enjoy-live")!;
    expect(enjoy.ok).toBe(false);
    expect(enjoy.retained).toBe(true);
    expect(enjoy.error).toContain("Cloudflare challenge");
    // The day still renders the show, and says why the listings cannot be fully trusted.
    app.isolate();
    const html = await (await app.get(`/?lang=en&date=${showDate}`)).text();
    expect(html).toContain("Sold Out Artist");
    expect(html).not.toContain('class="empty degraded"');
    expect(html).toContain('class="notice"');
  } finally { fetcher.mockRestore(); }
});

test("a source already missing from the snapshot is recovered from the archive", async () => {
  const today = jstNow().date;
  const showDate = addDays(today, 5);
  // Production shape: an earlier failed refresh already emptied the snapshot, but the archive has the record.
  const app = setup([]);
  app.data.set(ARCHIVE_KEY, JSON.stringify({ updatedAt: "2026-11-05T00:00:00Z", sources: [], events: [
    { ...shows[0], id: "2026-11-11-aaaaaaaaaaaaaaaa", date: showDate, headline: "Archived Artist", url: "https://schedule.enjoy-live.net/artist.php?artist_id=archived", sources: ["enjoy-live.net"] },
  ] }));
  const fetcher = spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (input: Parameters<typeof fetch>[0]) => {
    if (String(input).includes("enjoy-live")) return new Response("challenge", { status: 403, headers: { "cf-mitigated": "challenge" } });
    return new Response(`<li class="clearfix"><span class="day0">${addDays(today, 4)}</span><h4><a href="/events/9102">Another artist</a></h4></li>`);
  }, { preconnect: fetch.preconnect }));
  try {
    let pending: Promise<unknown> | undefined;
    await worker.scheduled({} as ScheduledController, app.env, { waitUntil: (p: Promise<unknown>) => { pending = p; } } as ExecutionContext);
    await pending;
    const current = JSON.parse(app.data.get("snapshot")!) as Snapshot;
    const kept = current.events.find((e) => e.date === showDate);
    expect(kept?.headline).toBe("Archived Artist");
    // The published URL outlives the outage.
    expect(kept?.id).toBe("2026-11-11-aaaaaaaaaaaaaaaa");
    expect(current.sources.find((s) => s.name === "enjoy-live")?.retained).toBe(true);
  } finally { fetcher.mockRestore(); }
});

test("an empty day while a concert source is down never claims nothing is scheduled", async () => {
  const app = setup();
  const clock = spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-06T03:00:00Z"));
  const fetcher = spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (input: Parameters<typeof fetch>[0]) => {
    if (String(input).includes("enjoy-live")) return new Response("challenge", { status: 403, headers: { "cf-mitigated": "challenge" } });
    return new Response(`<li class="clearfix"><span class="day0">2026-11-20</span><h4><a href="/events/9101">Later artist</a></h4></li>`);
  }, { preconnect: fetch.preconnect }));
  try {
    let pending: Promise<unknown> | undefined;
    await worker.scheduled({} as ScheduledController, app.env, { waitUntil: (p: Promise<unknown>) => { pending = p; } } as ExecutionContext);
    await pending;
    const html = await (await app.get("/?lang=en&date=2026-11-12")).text();
    expect(html).toContain('class="empty degraded"');
    expect(html).toContain("Listings may be incomplete");
    expect(html).not.toContain("No public event is on the calendar for this day.");
    expect(html).toContain('class="notice"');
  } finally { fetcher.mockRestore(); clock.mockRestore(); }
});

test("page requests in one isolate share KV reads until the memo expires, and refreshes replace it", async () => {
  const app = setup();
  await app.get("/api/events");
  const before = app.reads.length;
  for (let i = 0; i < 5; i++) expect((await app.get("/?lang=en")).status).toBe(200);
  expect(app.reads.length).toBe(before);
  const clock = spyOn(Date, "now").mockReturnValue(Date.now() + 61_000);
  try {
    await app.get("/?lang=en");
    expect(app.reads.length).toBe(before + 1);
  } finally { clock.mockRestore(); }
});

test("dates outside the calendar window 404 without a redirect, and edge pages never link past it", async () => {
  const app = setup();
  for (const path of ["/?lang=zh-Hant&date=2074-01-31", "/?date=2074-01-31&lang=zh-Hant", "/?lang=en&date=2027-12-01", "/?lang=en&date=2026-09-30"]) {
    const response = await app.get(path);
    expect(response.status).toBe(404);
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
  }
  for (const date of ["2026-10-01", "2027-11-30"]) {
    const response = await app.get(`/?lang=en&date=${date}`);
    expect(response.status).toBe(200);
    const links = [...(await response.text()).matchAll(/href="\/\?lang=en(?:&#38;date=([\d-]+))?"/g)].map((m) => m[1]).filter(Boolean);
    expect(links).toContain(date);
    for (const linked of links) expect((await app.get(`/?lang=en&date=${linked}`)).status).toBe(200);
  }
});

const reportedDates = ["2027-03-16", "2027-03-01", "2027-10-14", "2027-02-09", "2027-01-23", "2027-02-06", "2027-07-03", "2027-04-05", "2027-02-28", "2027-01-17"];

test("reported empty dates and populated calendar views stay usable without competing for indexing", async () => {
  const app = setup();
  for (const date of [...reportedDates, shows[0].date, jstNow().date]) {
    for (const locale of LOCALES) {
      const response = await app.get(`/?lang=${locale}&date=${date}`);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('<meta name="robots" content="noindex, follow">');
      expect(html).toContain(`<link rel="canonical" href="${SITE}/?lang=${locale}&#38;date=${date}">`);
      expect(html).not.toContain('<link rel="alternate"');
      expect(html).not.toContain('"@type":"MusicEvent"');
    }
  }
});

test.each(LOCALES)("indexable %s pages agree with the sitemaps and preserve language during navigation", async (locale) => {
  const app = setup();
  const preferences: HeadersInit[] = [{ "Accept-Language": locale }, { cookie: `lang=${locale}`, "Accept-Language": "en" }];
  for (const headers of preferences) {
    const html = await (await app.get("/", headers)).text();
    expect(html).toContain(`<link rel="canonical" href="${SITE}/?lang=${locale}">`);
    expect(html).not.toContain('name="robots"');
    expect(html).toContain(`hreflang="${locale}" href="${SITE}/?lang=${locale}"`);
    // Calendar and day links must not depend on a visitor's cookie to keep the language.
    const dateLinks = [...html.matchAll(/<a [^>]*href="([^"]*date=[^"]*)"[^>]*>/g)];
    expect(dateLinks.length).toBeGreaterThan(50);
    for (const [tag, href] of dateLinks) {
      expect(href).toStartWith(`/?lang=${locale}&#38;date=`);
      expect(tag).toContain('rel="nofollow"');
    }
  }
  const xml = await (await app.get("/sitemap-events.xml")).text();
  for (const event of app.archive().events) {
    const url = `${SITE}${eventPath(event.id)}?lang=${locale}`;
    const html = await (await app.get(`${eventPath(event.id)}?lang=${locale}`)).text();
    expect(xml).toContain(`<loc>${url}</loc>`);
    expect(html).toContain(`<link rel="canonical" href="${url}">`);
    expect(html).not.toContain('name="robots"');
  }
});

test("equivalent query variants permanently redirect once to a normalized URL", async () => {
  const app = setup();
  await app.get("/api/events");
  const path = eventPath(app.archive().events[0].id);
  const cases = [
    ["/?date=2027-03-16&lang=en", "/?lang=en&date=2027-03-16"],
    ["/?lang=en&date=2027-03-16&utm_source=google", "/?lang=en&date=2027-03-16"],
    ["/?lang=ja&lang=en", "/?lang=ja"],
    ["/?lang=unsupported&date=bad", "/"],
    ["/?lang=ja&date=2027-02-30", "/?lang=ja"],
    [`${path.slice(0, -1)}?date=2027-03-16&lang=ja&utm_source=google`, `${path}?lang=ja`],
    [`${path}?lang=ko&date=2027-03-16`, `${path}?lang=ko`],
  ];
  for (const [input, target] of cases) {
    const response = await app.get(input);
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(`${SITE}${target}`);
    const destination = await app.get(target);
    expect(destination.status).toBe(200);
    expect(destination.headers.has("location")).toBe(false);
  }
});


test("a fixed date keeps its canonical and indexing policy when today changes", async () => {
  const app = setup();
  const clock = spyOn(Date, "now");
  try {
    for (const day of ["2027-03-16", "2027-03-17"]) {
      clock.mockReturnValue(Date.parse(`${day}T03:00:00Z`));
      const response = await app.get("/?lang=en&date=2027-03-16");
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('<link rel="canonical" href="https://budokan.hewig.dev/?lang=en&#38;date=2027-03-16">');
      expect(html).toContain('<meta name="robots" content="noindex, follow">');
      expect(await (await app.get("/?lang=en")).text()).not.toContain('name="robots"');
    }
  } finally { clock.mockRestore(); }
});
