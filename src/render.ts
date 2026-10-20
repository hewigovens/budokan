import { addDays, addMonths, utc } from "./dates";
import { GOOGLE_HL, INTL_LOCALE, LOCALE_NAMES, LOCALES, OFFICIAL_LINK_TEXT, SHORT_NAMES, STRINGS, type Locale, type Strings } from "./i18n";
import { GLOBE, LOGO, PIN, SPARKLE } from "./icons";
import { CSS } from "./styles";
import type { BudokanEvent, Snapshot } from "./types";

const esc = (s = "") => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ---- CJK line breaking -------------------------------------------------------------------
// Browsers break CJK text between any two characters, so 選手権大会 can end up as 選手権大 / 会.
// We render CJK runs with `word-break: keep-all` and add <wbr> only at word boundaries found
// by Intl.Segmenter, skipping spots that would orphan punctuation, small kana or numbers.
const CJK = /[぀-ヿ㐀-鿿豈-﫿가-힯ｦ-ﾟ]/;
const NO_BREAK_BEFORE = /^[、。，．・：；？！）」』】〕〉》〜ー…!?)\]}ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ]/;
const NO_BREAK_AFTER = /[（「『【〔〈《(\[{“‘]$/;
const NUMBER = /^[0-9０-９]+$/;
const segmenter = new Intl.Segmenter("ja", { granularity: "word" });

export function cjk(text = ""): string {
  if (!CJK.test(text)) return esc(text);
  const segs = [...segmenter.segment(text)].map((s) => s.segment);
  let out = esc(segs[0]);
  for (let i = 1; i < segs.length; i++) {
    const prev = segs[i - 1], cur = segs[i];
    const breakable =
      (CJK.test(prev) || CJK.test(cur)) &&
      !/\s/.test(prev + cur) &&
      !NUMBER.test(prev) && !NUMBER.test(cur) &&
      !NO_BREAK_BEFORE.test(cur) && !NO_BREAK_AFTER.test(prev);
    out += (breakable ? "<wbr>" : "") + esc(cur);
  }
  return out;
}

// Official listings join two tournaments with ・ ("…選手権大会・…選手権大会"); show one per line.
function headline(ev: BudokanEvent): string {
  const parts = ev.kind === "budo" ? ev.headline.split("・") : [ev.headline];
  return parts.length === 2 && parts.every((p) => p.length >= 6)
    ? parts.map((p) => `<span class="line">${cjk(p)}</span>`).join("")
    : cjk(ev.headline);
}

const fmt = (locale: Locale, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: "UTC", ...opts });

const mins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// ---- Pieces ------------------------------------------------------------------------------
interface Ctx {
  locale: Locale;
  t: Strings;
  longDate: (date: string) => string;
  fullDate: (date: string) => string;
}

// Google AI Mode is the udm=50 search vertical.
const aiModeUrl = (prompt: string, locale: Locale) =>
  `https://www.google.com/search?udm=50&hl=${GOOGLE_HL[locale]}&q=${encodeURIComponent(prompt)}`;

function askAboutEvent(ev: BudokanEvent, ctx: Ctx): string {
  const name = [ev.headline, subtitleOf(ev)].filter(Boolean).join(" ");
  return aiModeUrl(ctx.t.askAIAbout(name, ctx.fullDate(ev.date)), ctx.locale);
}

type Status = { label: string; tone: "live" | "soon" | "done" };

function status(ev: BudokanEvent, nowTime: string, t: Strings): Status | undefined {
  if (!ev.start) return undefined;
  const now = mins(nowTime);
  const open = ev.open ? mins(ev.open) : mins(ev.start) - 60;
  const start = mins(ev.start);
  const end = ev.end ? mins(ev.end) : start + 180;
  if (now >= end) return { label: t.statusFinished, tone: "done" };
  if (now >= start) return { label: t.statusOnNow, tone: "live" };
  if (now >= open) return { label: t.statusDoorsOpen, tone: "soon" };
  return { label: ev.open ? t.statusDoorsAt(ev.open) : t.statusDoorsAt("TBA"), tone: "soon" };
}

function badge(ev: BudokanEvent, { t }: Ctx): string {
  if (ev.kind === "concert") return `<span class="badge concert">${t.live}</span>`;
  const sport = ev.sport ?? "Martial arts";
  return `<span class="badge budo">${esc(t.sports[sport] ?? sport)}</span>`;
}

// Each chunk stays on one line so "Ends 21:00" never splits.
function times(ev: BudokanEvent, { t }: Ctx): string {
  if (ev.kind === "budo" && !ev.start) return `<span class="chunk">${t.daytime}</span>`;
  const bits = [ev.open && t.doors(ev.open), ev.start && t.start(ev.start), ev.end && t.ends(ev.end)].filter(Boolean) as string[];
  // The separator sits at the end of the previous chunk so a wrapped line never starts with "·".
  return bits.length
    ? bits.map((b, i) => `<span class="chunk">${esc(b)}${i < bits.length - 1 ? " ·" : ""}</span>`).join(" ")
    : `<span class="chunk">${t.timesTBA}</span>`;
}

const subtitleOf = (ev: BudokanEvent) => (ev.title && ev.title !== ev.headline ? ev.title : "");

function heroCard(ev: BudokanEvent, ctx: Ctx, nowTime?: string): string {
  const st = nowTime ? status(ev, nowTime, ctx.t) : undefined;
  const sub = subtitleOf(ev);
  return `<article class="hero-card ${ev.kind}">
  ${ev.image ? `<img src="${esc(ev.image)}" alt="" loading="lazy" width="96" height="96">` : ""}
  <div class="hero-body">
    <div class="meta">${badge(ev, ctx)}${st ? `<span class="status ${st.tone}">${esc(st.label)}</span>` : ""}</div>
    <h2 lang="ja">${headline(ev)}</h2>
    ${sub ? `<p class="sub" lang="ja">${cjk(sub)}</p>` : ""}
    <p class="times">${times(ev, ctx)}</p>
    ${ev.organizer ? `<p class="org" lang="ja">${cjk(ev.organizer)}</p>` : ""}
    <div class="actions">
      <a class="btn ai" href="${esc(askAboutEvent(ev, ctx))}" target="_blank" rel="noopener">${SPARKLE}${ctx.t.askAI}</a>
      ${ev.url ? `<a class="btn" href="${esc(ev.url)}" target="_blank" rel="noopener">${ctx.t.details} ↗</a>` : ""}
    </div>
  </div>
</article>`;
}

function row(ev: BudokanEvent, ctx: Ctx): string {
  const d = utc(ev.date);
  const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6 ? " weekend" : "";
  const sub = subtitleOf(ev);
  return `<li><a class="row-link" href="${esc(ev.url)}" target="_blank" rel="noopener">
  <span class="day${weekend}"><b>${d.getUTCDate()}</b>${esc(fmt(ctx.locale, { weekday: "short" }).format(d))}</span>
  <span class="what"><span class="name" lang="ja">${headline(ev)}</span>${sub ? `<span class="sub" lang="ja">${cjk(sub)}</span>` : ""}<span class="small">${badge(ev, ctx)} ${times(ev, ctx)}</span></span>
</a><a class="ask" href="${esc(askAboutEvent(ev, ctx))}" target="_blank" rel="noopener" title="${esc(ctx.t.askAI)}" aria-label="${esc(ctx.t.askAI)}">${SPARKLE}</a></li>`;
}

function upcoming(events: BudokanEvent[], ctx: Ctx): string {
  const monthFmt = fmt(ctx.locale, { year: "numeric", month: "long" });
  let html = "";
  let month = "";
  for (const ev of events) {
    const key = ev.date.slice(0, 7);
    if (key !== month) {
      html += `${month ? "</ul>" : ""}<h3>${esc(monthFmt.format(utc(ev.date)))}</h3><ul class="list">`;
      month = key;
    }
    html += row(ev, ctx);
  }
  return html + (month ? "</ul>" : "");
}

// A <details> dropdown works without any JavaScript.
function langSwitcher(current: Locale, date: string, isToday: boolean, t: Strings): string {
  const items = LOCALES.map((l) => {
    const href = `/?lang=${l}${isToday ? "" : `&amp;date=${date}`}`;
    return l === current
      ? `<span aria-current="true" lang="${l}">${LOCALE_NAMES[l]} ✓</span>`
      : `<a href="${href}" lang="${l}" hreflang="${l}">${LOCALE_NAMES[l]}</a>`;
  }).join("");
  return `<details class="lang"><summary aria-label="${t.language}">${GLOBE}<span>${SHORT_NAMES[current]}</span></summary><div class="menu">${items}</div></details>`;
}

// ---- SEO ---------------------------------------------------------------------------------
const SITE = "https://budokan.hewig.dev";
const VENUE = {
  "@type": "Place",
  name: "日本武道館 (Nippon Budokan)",
  address: { "@type": "PostalAddress", streetAddress: "北の丸公園2-3", addressLocality: "千代田区", addressRegion: "東京都", postalCode: "102-8321", addressCountry: "JP" },
  geo: { "@type": "GeoCoordinates", latitude: 35.6933, longitude: 139.7499 },
};

const OG_LOCALE: Record<Locale, string> = { en: "en_GB", ja: "ja_JP", "zh-Hans": "zh_CN", "zh-Hant": "zh_TW", ko: "ko_KR" };

const pageUrl = (locale: Locale, date?: string) => `${SITE}/?lang=${locale}${date ? `&date=${date}` : ""}`;

function jsonLd(events: BudokanEvent[]): string {
  const data = events.map((e) => ({
    "@context": "https://schema.org",
    "@type": e.kind === "budo" ? "SportsEvent" : "MusicEvent",
    name: e.title && e.title !== e.headline ? `${e.headline} ${e.title}` : e.headline,
    startDate: e.start ? `${e.date}T${e.start}:00+09:00` : e.date,
    ...(e.end && { endDate: `${e.date}T${e.end}:00+09:00` }),
    ...(e.open && { doorTime: `${e.date}T${e.open}:00+09:00` }),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: VENUE,
    ...(e.kind === "concert" && { performer: { "@type": "PerformingGroup", name: e.headline } }),
    ...(e.organizer && { organizer: { "@type": "Organization", name: e.organizer } }),
    ...(e.image && { image: e.image }),
    ...(e.url && { url: e.url }),
  }));
  // "<" escaped so event text can't close the script element.
  return data.length ? `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>` : "";
}

function seo(locale: Locale, date: string | undefined, title: string, description: string, events: BudokanEvent[]): string {
  const alternates = LOCALES.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(pageUrl(l, date))}">`).join("\n");
  const xDefault = `${SITE}/${date ? `?date=${date}` : ""}`;
  return `<link rel="canonical" href="${esc(pageUrl(locale, date))}">
${alternates}
<link rel="alternate" hreflang="x-default" href="${esc(xDefault)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(STRINGS[locale].brand)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(pageUrl(locale, date))}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(STRINGS[locale].brand)}">
<meta property="og:locale" content="${OG_LOCALE[locale]}">
<meta name="twitter:card" content="summary_large_image">
${jsonLd(events)}`;
}

// ---- Mini calendar (wide screens) ---------------------------------------------------------
function monthGrid(ym: string, byDate: Map<string, BudokanEvent[]>, selected: string, today: string, ctx: Ctx, nav?: { prev: string; next: string }): string {
  const first = utc(`${ym}-01`);
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const narrow = fmt(ctx.locale, { weekday: "narrow" });
  // 2026-11-01 is a Sunday; use it to label the weekday columns.
  const heads = Array.from({ length: 7 }, (_, i) => `<span class="wd${i === 0 || i === 6 ? " we" : ""}">${esc(narrow.format(utc(`2026-11-0${i + 1}`)))}</span>`).join("");
  let cells = "<span></span>".repeat(first.getUTCDay());
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${ym}-${String(d).padStart(2, "0")}`;
    const evs = byDate.get(date) ?? [];
    const cls = [
      "cell",
      date === selected && "sel",
      date === today && "today",
      date < today && "past",
      evs.some((e) => e.kind === "concert") && "has-concert",
      evs.some((e) => e.kind === "budo") && "has-budo",
    ].filter(Boolean).join(" ");
    const title = evs.map((e) => e.headline).join(" / ");
    cells += `<a class="${cls}" href="/?date=${date}"${title ? ` title="${esc(title)}"` : ""}>${d}${evs.length ? `<i></i>` : ""}</a>`;
  }
  const title = esc(fmt(ctx.locale, { year: "numeric", month: "long" }).format(first));
  const header = nav
    ? `<div class="cal-head"><a href="/?date=${nav.prev}" aria-label="${ctx.t.prevMonth}">‹</a><b>${title}</b><a href="/?date=${nav.next}" aria-label="${ctx.t.nextMonth}">›</a></div>`
    : `<div class="cal-head"><b>${title}</b></div>`;
  return `<div class="cal">${header}<div class="grid">${heads}${cells}</div></div>`;
}

function calendar(events: BudokanEvent[], selected: string, today: string, ctx: Ctx): string {
  const byDate = new Map<string, BudokanEvent[]>();
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  const ym = selected.slice(0, 7);
  // Jumping to a month lands on its 1st, or on today when that's the current month.
  const landing = (m: string) => (m === today.slice(0, 7) ? today : `${m}-01`);
  const nextYm = addMonths(ym, 1);
  return `<aside class="sidebar">
    ${monthGrid(ym, byDate, selected, today, ctx, { prev: landing(addMonths(ym, -1)), next: landing(nextYm) })}
    ${monthGrid(nextYm, byDate, selected, today, ctx)}
    <p class="legend"><span class="k concert"></span>${ctx.t.live}<span class="k budo"></span>${esc(ctx.t.sports["Martial arts"] ?? "Martial arts")}</p>
  </aside>`;
}

// ---- Page --------------------------------------------------------------------------------
export function renderPage(
  snap: Snapshot,
  opts: { date: string; now: { date: string; time: string }; locale?: Locale; health?: "ok" | "warning" | "error" },
): string {
  const { date, now } = opts;
  const locale = opts.locale ?? "en";
  const t = STRINGS[locale];
  const longFmt = fmt(locale, { weekday: "short", month: "short", day: "numeric" });
  const fullFmt = fmt(locale, { year: "numeric", month: "long", day: "numeric" });
  const ctx: Ctx = { locale, t, longDate: (d) => longFmt.format(utc(d)), fullDate: (d) => fullFmt.format(utc(d)) };

  const isToday = date === now.date;
  const todays = snap.events.filter((e) => e.date === date);
  const later = snap.events.filter((e) => e.date > date);
  const next = later[0];
  const updated = new Date(snap.updatedAt).toLocaleString(INTL_LOCALE[locale], { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" });
  const label = isToday ? t.today : date === addDays(now.date, 1) ? t.tomorrow : date < now.date ? t.pastDay : t.upcoming;
  const title = isToday ? t.brand : `${ctx.fullDate(date)} · ${t.brand}`;
  const description = todays.length ? `${ctx.fullDate(date)}: ${todays.map((e) => e.headline).join(" / ")}. ${t.description}` : t.description;
  const link = (href: string, text: string) => `<a href="${href}">${text}</a>`;

  const hero = todays.length
    ? todays.map((e) => heroCard(e, ctx, isToday ? now.time : undefined)).join("")
    : `<div class="empty">
        <h2>${t.nothingTitle}</h2>
        <p>${isToday ? t.nothingToday : t.nothingDay}</p>
        ${next ? `<p class="next">${t.next(`<span lang="ja">${cjk(next.headline)}</span>`, esc(ctx.longDate(next.date)))}</p>` : ""}
        <div class="actions"><a class="btn ai" href="${esc(aiModeUrl(t.askAIDay(ctx.fullDate(date)), locale))}" target="_blank" rel="noopener">${SPARKLE}${t.askAI}</a></div>
      </div>`;

  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${seo(locale, isToday ? undefined : date, title, description, todays)}
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Budokan">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#f5f1e8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#14141a" media="(prefers-color-scheme: dark)">
<style>${CSS}</style>
</head>
<body>
<div class="page">
  <header class="top">
    <div class="brand">${LOGO}<div><strong>${t.brand}</strong><span>${t.sub}</span></div></div>
    <div class="tools">
      ${langSwitcher(locale, date, isToday, t)}
      <a class="pill" href="https://maps.app.goo.gl/9UYqFcwpWaisgubK9" target="_blank" rel="noopener">${PIN}${t.map}</a>
    </div>
  </header>
<div class="layout">
<main>
  <p class="offline" id="offline" hidden>${t.offline}</p>
  <section class="today">
    <nav class="daynav">
      <a href="/?date=${addDays(date, -1)}" aria-label="${t.prevDay}">‹</a>
      <div><span class="label">${label}</span><span class="date">${esc(ctx.longDate(date))}</span></div>
      <a href="/?date=${addDays(date, 1)}" aria-label="${t.nextDay}">›</a>
    </nav>
    ${hero}
    ${isToday ? "" : `<a class="back" href="/">${t.backToToday}</a>`}
  </section>

  <section class="upcoming">
    <h2 class="section">${t.comingUp}</h2>
    ${later.length ? upcoming(later, ctx) : `<p class="muted">${t.noUpcoming}</p>`}
  </section>

  <footer>
    <p>${t.footer({
      enjoy: link("https://schedule.enjoy-live.net/schedule.php?hall_id=3", "enjoy-live.net"),
      eventernote: link("https://www.eventernote.com/places/3/events", "Eventernote"),
      official: link("https://www.nipponbudokan.or.jp/shinkoujigyou/gyouji_08", OFFICIAL_LINK_TEXT[locale]),
    })}</p>
    <p>${esc(t.updated(updated))}${opts.health && opts.health !== "ok" ? ` · <a class="warn" href="/health">⚠ ${t.dataIssue}</a>` : ""}</p>
  </footer>
</main>
${calendar(snap.events, date, now.date, ctx)}
</div>
</div>
<script>
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
const off = document.getElementById("offline");
const sync = () => (off.hidden = navigator.onLine);
addEventListener("online", sync);
addEventListener("offline", sync);
sync();
</script>
</body>
</html>`;
}

