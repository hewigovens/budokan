import { expect, test } from "bun:test";
import { checkHealth } from "../src/health";
import type { Snapshot } from "../src/types";

const NOW = Date.parse("2026-10-20T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();
const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  updatedAt: hoursAgo(1),
  events: [],
  errors: [],
  sources: [
    { name: "enjoy-live", ok: true, count: 40, checkedAt: hoursAgo(1), lastSuccessAt: hoursAgo(1) },
    { name: "eventernote", ok: true, count: 50, checkedAt: hoursAgo(1), lastSuccessAt: hoursAgo(1) },
  ],
  ...over,
});

test("healthy snapshot", () => {
  expect(checkHealth(snap(), NOW, "2026-10-20").status).toBe("ok");
});

test("one failed run is a warning, a day of failures is an error", () => {
  const failing = (lastOk: number) =>
    snap({ sources: [{ name: "eventernote", ok: false, count: 0, error: "HTTP 500", checkedAt: hoursAgo(1), lastSuccessAt: hoursAgo(lastOk) }] });
  expect(checkHealth(failing(7), NOW, "2026-10-20")).toMatchObject({ status: "warning" });
  const h = checkHealth(failing(30), NOW, "2026-10-20");
  expect(h.status).toBe("error");
  expect(h.problems[0]).toContain("eventernote: HTTP 500");
});

test("stale data and expired budo list are errors", () => {
  expect(checkHealth(snap({ updatedAt: hoursAgo(20) }), NOW, "2026-10-20").problems[0]).toContain("cron");
  expect(checkHealth(snap(), NOW, "2027-04-02").problems[0]).toContain("src/budo.ts");
});
