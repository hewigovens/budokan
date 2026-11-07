import { expect, test } from "bun:test";
import { esc } from "../src/html";
import { INTL_LOCALE, LOCALES, STRINGS, pickLocale } from "../src/i18n";
import { cjk, renderPage } from "../src/render";
import type { Snapshot } from "../src/types";

test("pickLocale: query > cookie > Accept-Language", () => {
  expect(pickLocale("ko", "lang=ja", "zh-CN")).toBe("ko");
  expect(pickLocale(null, "x=1; lang=ja", "zh-CN")).toBe("ja");
  expect(pickLocale(null, null, "zh-TW,zh;q=0.9,en;q=0.8")).toBe("zh-Hant");
  expect(pickLocale(null, null, "zh-CN,zh;q=0.9")).toBe("zh-Hans");
  expect(pickLocale(null, null, "fr-FR,ja;q=0.5")).toBe("ja");
  expect(pickLocale("xx", null, null)).toBe("en");
});

test("cjk: breaks only at word boundaries, never inside numbers or before punctuation", () => {
  expect(cjk("第74回全日本剣道選手権大会")).toBe("第74回<wbr>全日本<wbr>剣道<wbr>選手権<wbr>大会");
  expect(cjk("あれから、そして")).toBe("あれ<wbr>から、<wbr>そして");
  expect(cjk("BAND-MAID WORLD TOUR")).toBe("BAND-MAID WORLD TOUR");
  expect(cjk("<script>剣道")).not.toContain("<script>");
});

test("renderPage localizes UI and tags event text as Japanese", () => {
  const snap: Snapshot = {
    updatedAt: "2026-10-20T00:00:00Z",
    sources: [],
    events: [{ date: "2026-11-03", kind: "budo", headline: "第74回全日本剣道選手権大会・第65回全日本女子剣道選手権大会", sport: "Kendo", sources: [] }],
  };
  const now = { date: "2026-11-03", time: "10:00" };
  const zh = renderPage(snap, { date: "2026-11-03", now, locale: "zh-Hans" });
  expect(zh).toContain('<html lang="zh-Hans">');
  expect(zh).toContain(">剑道<");
  expect(zh).toContain('<h2 lang="ja"><span class="line">');
  expect(renderPage(snap, { date: "2026-11-03", now, locale: "ja" })).toContain("11月3日(火)");
});

test("renderPage emits canonical, hreflang and escaped page JSON-LD", () => {
  const snap: Snapshot = {
    updatedAt: "2026-10-20T00:00:00Z",
    sources: [],
    events: [{ date: "2026-11-04", kind: "concert", headline: "</script><b>x", start: "18:30", sources: [] }],
  };
  const html = renderPage(snap, { date: "2026-11-04", now: { date: "2026-11-03", time: "10:00" }, locale: "ja" });
  expect(html).toContain('<link rel="canonical" href="https://budokan.hewig.dev/?lang=ja&#38;date=2026-11-04">');
  const negotiated = renderPage(snap, { now: { date: "2026-11-03", time: "10:00" }, locale: "ja" });
  expect(negotiated).toContain('<link rel="canonical" href="https://budokan.hewig.dev/?lang=ja">');
  expect(negotiated).toContain('hreflang="x-default" href="https://budokan.hewig.dev/"');
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1]);
  expect(data).toMatchObject({
    "@type": "CollectionPage",
    url: "https://budokan.hewig.dev/?lang=ja&date=2026-11-04",
    inLanguage: "ja",
  });
  expect(data.description).toContain("</script><b>x");
  expect(html).not.toContain("</script><b>");
});

test.each(LOCALES)("%s schedule pages do not advertise individual event rich results", (locale) => {
  const snap: Snapshot = {
    updatedAt: "2026-10-25T00:00:00Z",
    sources: [],
    events: [
      // Sparse source data must not turn a schedule into an event page.
      { date: "2026-10-25", kind: "concert", headline: "郷ひろみ", title: "Concert Tour 2026", sources: [] },
      { date: "2026-11-03", kind: "budo", headline: "剣道選手権大会", organizer: "全日本剣道連盟", sources: [] },
      { date: "2026-11-03", kind: "concert", headline: "Evening concert", start: "18:30", end: "21:00", sources: [] },
    ],
  };
  const now = { date: "2026-10-25", time: "10:00" };
  for (const date of [now.date, "2026-11-03", "2026-11-04"]) {
    const html = renderPage(snap, { date: date === now.date ? undefined : date, now, locale });
    const data = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1]);
    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      url: `https://budokan.hewig.dev/?lang=${locale}${date === now.date ? "" : `&date=${date}`}`,
      inLanguage: locale,
      about: { "@type": "Place", name: "日本武道館 (Nippon Budokan)" },
    });
    expect(html).not.toMatch(/"@type":"(?:Event|MusicEvent|SportsEvent)"/);
  }
});

test.each(LOCALES)("%s renders a source failure as incomplete rather than as an empty day", (locale) => {
  const snap: Snapshot = {
    updatedAt: "2026-10-25T00:00:00Z",
    sources: [{ name: "enjoy-live", ok: false, count: 0, error: "HTTP 403", checkedAt: "2026-10-25T00:00:00Z", lastSuccessAt: "2026-10-24T00:00:00Z", retained: true }],
    events: [{ date: "2026-11-05", kind: "budo", headline: "剣道選手権大会", sport: "Kendo", sources: [] }],
  };
  const now = { date: "2026-10-25", time: "10:00" };
  const html = renderPage(snap, { date: "2026-11-04", now, locale, incomplete: true });
  const t = STRINGS[locale];
  expect(html).toContain(esc(t.degradedTitle));
  expect(html).toContain(esc(t.degradedBody));
  expect(html).toContain(esc(t.degradedNotice));
  expect(html).not.toContain(esc(t.nothingTitle));
  expect(html).not.toContain(esc(t.nothingDay));
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1]);
  expect(data.description).toBe(t.metaDegradedDesc(new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }).format(new Date("2026-11-04T00:00:00Z"))));
});

test("a completed day with every source healthy still says nothing is listed", () => {
  const snap: Snapshot = { updatedAt: "2026-10-25T00:00:00Z", sources: [], events: [] };
  const html = renderPage(snap, { date: "2026-11-04", now: { date: "2026-10-25", time: "10:00" }, locale: "en" });
  expect(html).toContain("Nothing listed");
  expect(html).not.toContain('class="empty degraded"');
  expect(html).not.toContain('class="notice"');
});
