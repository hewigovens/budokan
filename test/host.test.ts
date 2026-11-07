import { afterAll, beforeAll, expect, setSystemTime, spyOn, test } from "bun:test";
import host from "../host/workerd/worker";
import { addDays, jstNow } from "../src/dates";
import type { Snapshot } from "../src/types";

beforeAll(() => setSystemTime(new Date("2026-11-06T03:00:00Z")));
afterAll(() => setSystemTime());

function disk(files: Map<string, string>, writable = false) {
  return { fetch: async (input: RequestInfo, init?: RequestInit) => {
    const key = decodeURIComponent(new URL(String(input)).pathname.slice(1));
    if (init?.method === "PUT") {
      if (!writable) return new Response(null, { status: 405 });
      files.set(key, String(init.body));
      return new Response(null, { status: 204 });
    }
    return files.has(key) ? new Response(files.get(key)) : new Response(null, { status: 404 });
  } } as unknown as Fetcher;
}

function setup() {
  const data = new Map<string, string>();
  const files = new Map([["_headers", "/icon*\n  Cache-Control: public, max-age=31536000, immutable\n"], ["icon-192.png", "png"]]);
  const env = { STORE: disk(data, true), PUBLIC: disk(files) };
  const get = (path: string, init?: RequestInit, host_ = "budokan.hewig.dev") => host.fetch(new Request(`https://${host_}${path}`, init), env);
  return { data, get };
}

test("static files get their _headers rules, and _headers itself stays private", async () => {
  const { get } = setup();
  const icon = await get("/icon-192.png");
  expect(icon.headers.get("content-type")).toBe("image/png");
  expect(icon.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  expect((await get("/_headers")).status).toBe(404);
});

test("the refresh host runs the cron into the disk store, and only on POST", async () => {
  const { data, get } = setup();
  expect((await get("/", undefined, "refresh.internal")).status).toBe(405);
  const date = addDays(jstNow().date, 10);
  const fetcher = spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (input: Parameters<typeof fetch>[0]) => String(input).includes("enjoy-live")
    ? new Response("blocked", { status: 403 })
    : new Response(`<li class="clearfix"><span class="day0">${date}</span><h4><a href="/events/9001">Future artist</a></h4>開場 17:00 開演 18:00</li>`), { preconnect: fetch.preconnect }));
  try {
    expect((await get("/", { method: "POST" }, "refresh.internal")).status).toBe(200);
  } finally { fetcher.mockRestore(); }
  const snapshot = JSON.parse(data.get("snapshot")!) as Snapshot;
  expect(snapshot.events.find((e) => e.date === date)?.headline).toBe("Future artist");
  expect((await get(`/?lang=en&date=${date}`)).status).toBe(200);
});
