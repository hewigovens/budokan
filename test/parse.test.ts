import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { budoEvents, sportOf } from "../src/budo";
import { mergeEvents } from "../src/merge";
import { decode, parseEnjoyLive, parseEventernote } from "../src/scrape";

const fixture = (name: string) => readFileSync(`${import.meta.dir}/fixtures/${name}`, "utf8");

test("enjoy-live parses dated concerts", () => {
  const evs = parseEnjoyLive(fixture("enjoylive.html"));
  expect(evs.length).toBeGreaterThan(20);
  expect(evs[0]).toMatchObject({ date: "2026-10-01", headline: "SHOW-WA", title: "2026 日本武道館コンサート" });
  expect(evs.find((e) => e.date === "2026-10-05")?.headline).toBe("超ときめき♡宣伝部");
  expect(evs.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date))).toBe(true);
});

test("eventernote parses times, actors and images", () => {
  const evs = parseEventernote(fixture("eventernote.html"));
  expect(evs).toHaveLength(30);
  const band = evs.find((e) => e.date === "2026-11-13")!;
  expect(band).toMatchObject({ headline: "BAND-MAID", open: "17:00", start: "18:00", end: "21:00" });
  expect(band.image).toStartWith("https://eventernote");
});

test("merge dedupes the same show across sources", () => {
  const merged = mergeEvents(parseEnjoyLive(fixture("enjoylive.html")), parseEventernote(fixture("eventernote.html")));
  const band = merged.filter((e) => e.date === "2026-11-13");
  expect(band).toHaveLength(1);
  expect(band[0].sources).toEqual(["enjoy-live.net", "eventernote.com"]);
  expect(band[0].start).toBe("18:00");
});

test("budo schedule and sport tagging", () => {
  expect(sportOf("第26回全日本短剣道大会")).toBe("Jukendo");
  expect(sportOf("第74回全日本剣道選手権大会")).toBe("Kendo");
  expect(budoEvents().find((e) => e.date === "2026-11-03")?.sport).toBe("Kendo");
});

test("decode handles entities", () => {
  expect(decode("it&rsquo;s &amp; &#x2661; <b>x</b>")).toBe("it’s & ♡ x");
});
