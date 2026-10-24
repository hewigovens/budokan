import { expect, test } from "bun:test";
import { publishEvents } from "../src/events";
import { mergeEvents } from "../src/merge";
import type { BudokanEvent } from "../src/types";

const concert: BudokanEvent = {
  date: "2026-11-13", kind: "concert", headline: "BAND-MAID", title: "WORLD TOUR 2026 FINAL",
  url: "https://schedule.enjoy-live.net/artist.php?artist_id=band-maid", sources: ["enjoy-live.net"],
};

test("first publication is deterministic across concurrent migrations and feed order", async () => {
  const other = { ...concert, date: "2026-11-14" };
  const a = await publishEvents([concert, other], []);
  const b = await publishEvents([other, concert], []);
  expect(a.events.map((e) => e.id)).toEqual(b.events.map((e) => e.id).reverse());
  expect(a.events[0].id).toMatch(/^2026-11-13-[a-f0-9]{16}$/);
  expect(a.events[0].id).not.toBe(a.events[1].id);
});

test("published URLs survive enrichment, corrected titles, preferred-source changes and rescheduling", async () => {
  const first = await publishEvents([concert], []);
  const extra: BudokanEvent = { ...concert, start: "18:00", url: "https://www.eventernote.com/events/462037", sources: ["eventernote.com"] };
  const enriched = await publishEvents(mergeEvents([concert], [extra]), first.archive);
  expect(enriched.events[0].id).toBe(first.events[0].id);
  expect(enriched.events[0].sourceUrls).toContain(concert.url!);
  const corrected = await publishEvents([{ ...extra, headline: "Corrected artist", title: "Corrected tour", start: "19:00", date: "2026-11-20" }], enriched.archive);
  expect(corrected.events[0].id).toBe(first.events[0].id);
  expect(corrected.events[0].date).toBe("2026-11-20");
  expect(corrected.archive).toHaveLength(1);
});

test("events remain in the archive after the rolling feed drops them", async () => {
  const first = await publishEvents([concert], []);
  const later = await publishEvents([{ ...concert, date: "2027-01-01" }], first.archive);
  expect(later.events).toHaveLength(1);
  expect(later.archive).toHaveLength(2);
  expect(later.archive.find((e) => e.id === first.events[0].id)).toMatchObject(concert);
  const empty = await publishEvents([], later.archive);
  expect(empty.archive).toEqual(later.archive);
});

test("a shared official schedule URL does not identify different martial-arts events", async () => {
  const base: BudokanEvent = { date: "2026-11-03", kind: "budo", headline: "剣道選手権大会", url: "https://www.nipponbudokan.or.jp/shinkoujigyou/gyouji_08", sources: [] };
  const first = await publishEvents([base, { ...base, headline: "柔道選手権大会" }], []);
  const next = await publishEvents([{ ...base, headline: "柔道選手権大会" }, base], first.archive);
  expect(first.events[0].id).not.toBe(first.events[1].id);
  expect(next.events.map((e) => e.id)).toEqual(first.events.map((e) => e.id).reverse());
});

test("separate performances on the same day keep separate pages after merging", async () => {
  const shows = [
    { ...concert, start: "14:00", url: "https://www.eventernote.com/events/1001" },
    { ...concert, start: "18:00", url: "https://www.eventernote.com/events/1002" },
  ];
  const merged = mergeEvents([concert], shows);
  expect(merged).toHaveLength(2);
  const first = await publishEvents(merged, []);
  const next = await publishEvents([...merged].reverse(), first.archive);
  expect(new Set(first.events.map((e) => e.id)).size).toBe(2);
  expect(next.events.map((e) => e.id)).toEqual(first.events.map((e) => e.id).reverse());
});
