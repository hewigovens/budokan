import { expect, test } from "bun:test";
import { pickLocale } from "../src/i18n";
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

test("renderPage emits canonical, hreflang and escaped JSON-LD", () => {
  const snap: Snapshot = {
    updatedAt: "2026-10-20T00:00:00Z",
    sources: [],
    events: [{ date: "2026-11-04", kind: "concert", headline: "</script><b>x", start: "18:30", sources: [] }],
  };
  const html = renderPage(snap, { date: "2026-11-04", now: { date: "2026-11-03", time: "10:00" }, locale: "ja" });
  expect(html).toContain('<link rel="canonical" href="https://budokan.hewig.dev/?lang=ja&#38;date=2026-11-04">');
  expect(html).toContain('hreflang="x-default" href="https://budokan.hewig.dev/?date=2026-11-04"');
  expect(html).toContain('"startDate":"2026-11-04T18:30:00+09:00"');
  expect(html).not.toContain("</script><b>");
});
