import { expect, test } from "bun:test";
import worker from "../src/index";
import type { Snapshot } from "../src/types";

const marker = "PRIVATE_DIAGNOSTIC_MARKER";
function snapshot(ok: boolean): Snapshot {
  const now = new Date().toISOString();
  return {
    updatedAt: now,
    sources: [{ name: "eventernote", ok, count: 1, checkedAt: now, error: marker }],
    events: [{ date: "2026-10-24", kind: "concert", headline: "Example Band", sources: [], image: "https://example.invalid/unlicensed.png" }],
  };
}
async function request(path: string, ok = true) {
  const data = new Map<string, Snapshot>([["snapshot", snapshot(ok)]]);
  const env = { EVENTS: {
    get: async (key: string) => data.get(key) ?? null,
    put: async (key: string, value: string) => { data.set(key, JSON.parse(value)); },
  } as unknown as KVNamespace };
  return worker.fetch(new Request(`https://example.test${path}`), env);
}

test("public health retains monitor status without source diagnostics", async () => {
  const res = await request("/health", false);
  expect(res.status).toBe(503);
  expect(res.headers.get("cache-control")).toBe("no-store");
  const body = await res.json() as Record<string, unknown>;
  expect(Object.keys(body).sort()).toEqual(["status", "updatedAt"]);
  expect(body.status).toBe("error");
  expect(JSON.stringify(body)).not.toContain(marker);
});

test("event API exposes listings but not diagnostics or cached image URLs", async () => {
  const res = await request("/api/events");
  const body = await res.json() as { events: Record<string, unknown>[] };
  expect(res.status).toBe(200);
  expect(body.events[0].headline).toBe("Example Band");
  expect(body.events[0].image).toBeUndefined();
  expect(Object.keys(body).sort()).toEqual(["events", "updatedAt"]);
  expect(JSON.stringify(body)).not.toContain(marker);
});

test("HTML and structured data ignore images already cached in KV", async () => {
  const html = await (await request("/?lang=en&date=2026-10-24")).text();
  expect(html).toContain("Example Band");
  expect(html).not.toContain("example.invalid/unlicensed.png");
  expect(html).not.toContain(marker);
});
