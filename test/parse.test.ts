import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { budoEvents, sportOf } from "../src/budo";
import { mergeEvents } from "../src/merge";
import { decode, describeFailure, parseEnjoyLive, parseEventernote } from "../src/scrape";

const fixture = (name: string) => readFileSync(`${import.meta.dir}/fixtures/${name}`, "utf8");

test("enjoy-live parses dated concerts", () => {
  const evs = parseEnjoyLive(fixture("enjoylive.html"));
  expect(evs.length).toBe(3);
  expect(evs[0]).toMatchObject({ date: "2026-10-01", headline: "Example & Friends", title: "Sample Tour" });
  expect(evs.find((e) => e.date === "2026-10-05")?.headline).toBe("Example ♡ Group");
  expect(evs.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date))).toBe(true);
});

test("eventernote parses times and actors but ignores images", () => {
  const evs = parseEventernote(fixture("eventernote.html"));
  expect(evs).toHaveLength(3);
  const band = evs.find((e) => e.date === "2026-11-13")!;
  expect(band).toMatchObject({ headline: "Example Band", open: "17:00", start: "18:00", end: "21:00" });
  expect(band.image).toBeUndefined();
  expect(evs[1]).toMatchObject({ headline: "One、Two、Three ほか", start: "18:30" });
  expect(evs[2].headline).toBe("Example Solo");
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

test("an upstream challenge is reported as a block, not as a bug in the parser", () => {
  expect(describeFailure(403, "challenge")).toBe("HTTP 403 (Cloudflare challenge; automated clients are blocked)");
  expect(describeFailure(500, null)).toBe("HTTP 500");
  expect(describeFailure(403, null)).toBe("HTTP 403");
});

test("a challenge page parses to zero events so it counts as a source failure", () => {
  // Cloudflare's interstitial is 200-ish HTML with no calendar markup; it must never look like an empty day.
  const challenge = `<html><head><title>Just a moment...</title></head><body><div class="main-content"></div></body></html>`;
  expect(parseEnjoyLive(challenge)).toHaveLength(0);
  expect(parseEventernote(challenge)).toHaveLength(0);
});

