import { GOOGLE_HL, INTL_LOCALE, LOCALE_NAMES, LOCALES, OFFICIAL_LINK_TEXT, STRINGS, type Locale, type Strings } from "./i18n";
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

// ---- Dates -------------------------------------------------------------------------------
const utc = (date: string) => new Date(`${date}T00:00:00Z`);
const shift = (date: string, n: number) => new Date(utc(date).getTime() + n * 86400_000).toISOString().slice(0, 10);
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

const SPARKLE = `<svg class="spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c.4 4.9 2.6 8.1 8 10-5.4 1.9-7.6 5.1-8 10-.4-4.9-2.6-8.1-8-10 5.4-1.9 7.6-5.1 8-10z" fill="currentColor"/></svg>`;

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

const SHORT_NAMES: Record<Locale, string> = { en: "EN", ja: "日本語", "zh-Hans": "简体", "zh-Hant": "繁體", ko: "한국어" };

const PIN = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>`;

const GLOBE = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>`;

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
  const addMonths = (ym: string, n: number) => {
    const d = utc(`${ym}-01`);
    d.setUTCMonth(d.getUTCMonth() + n);
    return d.toISOString().slice(0, 7);
  };
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
  const label = isToday ? t.today : date === shift(now.date, 1) ? t.tomorrow : date < now.date ? t.pastDay : t.upcoming;
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
<title>${t.brand}</title>
<meta name="description" content="${esc(t.description)}">
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
    <div class="brand">${ICON_INLINE}<div><strong>${t.brand}</strong><span>${t.sub}</span></div></div>
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
      <a href="/?date=${shift(date, -1)}" aria-label="${t.prevDay}">‹</a>
      <div><span class="label">${label}</span><span class="date">${esc(ctx.longDate(date))}</span></div>
      <a href="/?date=${shift(date, 1)}" aria-label="${t.nextDay}">›</a>
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

// Octagonal roof with the golden giboshi finial.
const ICON_PATHS = `<path d="M32 6c-3 3-4.5 5.5-4.5 8a4.5 4.5 0 0 0 9 0c0-2.5-1.5-5-4.5-8z" fill="#c9a24a"/>
<rect x="30.5" y="18" width="3" height="5" fill="#c9a24a"/>
<path d="M32 22c-8 6-17 10-27 12h54c-10-2-19-6-27-12z" fill="currentColor"/>
<rect x="10" y="36" width="44" height="4" rx="1" fill="currentColor" opacity=".75"/>
<path d="M14 42h36v14H14z" fill="currentColor" opacity=".9"/>
<path d="M28 48h8v8h-8z" fill="#c9a24a"/>`;

const ICON_INLINE = `<svg class="logo" viewBox="0 0 64 64" aria-hidden="true">${ICON_PATHS}</svg>`;


// Per-language font stacks so Han characters get the right regional glyphs
// (event names are Japanese, so they're tagged lang="ja" whatever the UI language).
const FONT_LATIN = `-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto`;
const FONT_JA = `"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic",Meiryo,"Noto Sans CJK JP","Noto Sans JP"`;
const FONT_SC = `"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC"`;
const FONT_TC = `"PingFang TC","Microsoft JhengHei","Noto Sans CJK TC","Noto Sans TC"`;
const FONT_KR = `"Apple SD Gothic Neo","Malgun Gothic","Noto Sans CJK KR","Noto Sans KR"`;

const CSS = `
:root{--bg:#f5f1e8;--card:#fffdf8;--ink:#1d1d26;--muted:#6b6862;--line:#e3ddd0;--gold:#a8822f;--live:#3c4bb0;--live-bg:#e8eafb;--budo:#9c2f2a;--budo-bg:#f7e5e2;--ok:#1f7a4a;--ok-bg:#dff3e7}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#14141a;--card:#1d1d26;--ink:#f1ede4;--muted:#9a968e;--line:#2d2c36;--gold:#d6b25e;--live:#a9b3ff;--live-bg:#262b4d;--budo:#f0a39c;--budo-bg:#46221f;--ok:#7fdca5;--ok-bg:#1c3a2a}}
:root[data-theme="dark"]{--bg:#14141a;--card:#1d1d26;--ink:#f1ede4;--muted:#9a968e;--line:#2d2c36;--gold:#d6b25e;--live:#a9b3ff;--live-bg:#262b4d;--budo:#f0a39c;--budo-bg:#46221f;--ok:#7fdca5;--ok-bg:#1c3a2a}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 ${FONT_LATIN},${FONT_JA},sans-serif;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
:lang(ja){font-family:${FONT_LATIN},${FONT_JA},sans-serif}
:lang(zh-Hans){font-family:${FONT_LATIN},${FONT_SC},sans-serif}
:lang(zh-Hant){font-family:${FONT_LATIN},${FONT_TC},sans-serif}
:lang(ko){font-family:${FONT_LATIN},${FONT_KR},sans-serif}
:lang(ja),:lang(zh),:lang(ko){line-break:strict}
.hero-card h2,.hero-card .sub,.hero-card .org,.name,.what .sub,.next [lang]{word-break:keep-all;overflow-wrap:anywhere}
:lang(ko){word-break:keep-all}
.page{max-width:1080px;margin:0 auto;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(40px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
main,.top{max-width:640px;margin-left:auto;margin-right:auto}
.sidebar{display:none}
a{color:inherit}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px;position:relative;z-index:2}
.tools{display:flex;gap:8px;align-items:center;flex:none}
.brand{display:flex;gap:10px;align-items:center;min-width:0}
.brand strong{display:block;font-size:17px;line-height:1.3;letter-spacing:-.01em}
.brand span{display:block;font-size:12px;color:var(--muted)}
.logo{width:36px;height:36px;flex:none;color:var(--ink)}
.pill,.lang summary{display:inline-flex;align-items:center;gap:6px;font-size:14px;text-decoration:none;border:1px solid var(--line);padding:0 14px;border-radius:999px;height:36px;background:var(--card);cursor:pointer;white-space:nowrap}
.lang{position:relative}
.lang summary{list-style:none;padding:0 12px}
.lang summary::-webkit-details-marker{display:none}
.lang summary svg,.pill svg{width:16px;height:16px;flex:none}
.lang[open] summary{border-color:var(--ink)}
.lang .menu{position:absolute;right:0;top:42px;min-width:160px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:6px;box-shadow:0 8px 24px rgba(0,0,0,.12);display:flex;flex-direction:column}
.lang .menu a,.lang .menu span{padding:10px 12px;border-radius:8px;text-decoration:none;font-size:15px}
.lang .menu span{font-weight:600;color:var(--gold)}
.lang .menu a:hover{background:var(--bg)}
@media (max-width:340px){.lang summary span{display:none}}
.daynav{display:flex;align-items:center;justify-content:space-between;margin:0 -8px 12px}
.daynav>div{text-align:center;min-width:0}
.daynav .label{display:block;font-size:12px;letter-spacing:.08em;color:var(--gold);font-weight:600}
html[lang="en"] .daynav .label,html[lang="en"] .section{text-transform:uppercase;letter-spacing:.12em}
.daynav .date{display:block;font-size:clamp(20px,6vw,26px);font-weight:700;letter-spacing:-.01em;white-space:nowrap}
.daynav a{flex:none;width:48px;height:48px;display:grid;place-items:center;font-size:30px;text-decoration:none;border-radius:50%;color:var(--muted)}
.daynav a:active{background:var(--card)}
.hero-card{display:flex;gap:14px;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;text-decoration:none;margin-bottom:10px;border-left:5px solid var(--live)}
.hero-card.budo{border-left-color:var(--budo)}
.hero-card img{width:96px;height:96px;border-radius:12px;object-fit:cover;flex:none}
.hero-body{min-width:0;flex:1}
.hero-card h2{margin:6px 0 4px;font-size:clamp(20px,5.6vw,25px);line-height:1.35;letter-spacing:-.01em;text-wrap:pretty}
.line{display:block}
.hero-card .sub{margin:0 0 8px;color:var(--muted);text-wrap:pretty}
.hero-card .times{margin:0;font-weight:600;font-variant-numeric:tabular-nums}
.hero-card .org{margin:4px 0 0;font-size:13px;color:var(--muted)}
.chunk{white-space:nowrap}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.btn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--line);font-size:14px;font-weight:600;text-decoration:none;white-space:nowrap}
.btn.ai{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.spark{width:15px;height:15px;flex:none;color:var(--gold)}
.btn.ai .spark{color:#e8c470}
.meta{display:flex;gap:6px;flex-wrap:wrap}
.badge,.status{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap;vertical-align:1px}
html[lang="en"] .badge,html[lang="en"] .status{text-transform:uppercase;letter-spacing:.04em}
.badge.concert{background:var(--live-bg);color:var(--live)}
.badge.budo{background:var(--budo-bg);color:var(--budo)}
.status.live{background:var(--ok-bg);color:var(--ok)}
.status.soon{background:var(--line);color:var(--ink)}
.status.done{background:transparent;color:var(--muted);border:1px solid var(--line)}
.empty{background:var(--card);border:1px dashed var(--line);border-radius:18px;padding:20px}
.empty h2{margin:0 0 6px;font-size:20px}
.empty p{margin:0;color:var(--muted)}
.empty .next{margin-top:12px;color:var(--ink)}
.back{display:inline-block;padding:8px 0;font-size:14px;color:var(--gold)}
.section{font-size:13px;letter-spacing:.06em;color:var(--muted);margin:32px 0 0}
.upcoming h3{font-size:15px;margin:22px 0 6px;color:var(--gold)}
.list{list-style:none;margin:0;padding:0;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.list li+li{border-top:1px solid var(--line)}
.list li{display:flex;align-items:stretch}
.row-link{flex:1;min-width:0;display:flex;gap:12px;padding:12px 0 12px 14px;text-decoration:none}
.list a:active{background:var(--bg)}
.ask{flex:none;width:48px;display:grid;place-items:center;color:var(--muted);text-decoration:none}
.ask .spark{width:18px;height:18px}
.day{flex:none;width:40px;text-align:center;font-size:11px;line-height:1.3;color:var(--muted)}
html[lang="en"] .day{text-transform:uppercase}
.day b{display:block;font-size:20px;line-height:1.15;color:var(--ink);font-variant-numeric:tabular-nums}
.day.weekend b{color:var(--gold)}
.what{min-width:0;flex:1;display:flex;flex-direction:column}
.name{font-weight:600;line-height:1.4}
.what .sub{font-size:13px;line-height:1.45;color:var(--muted)}
.small{font-size:12px;color:var(--muted);margin-top:4px;font-variant-numeric:tabular-nums;line-height:1.7}
.muted{color:var(--muted)}
footer .warn{color:var(--budo)}
.offline{margin:0 0 12px;padding:8px 12px;border-radius:10px;background:var(--budo-bg);color:var(--budo);font-size:13px;text-align:center}
footer{margin-top:40px;font-size:12px;color:var(--muted)}
footer p{margin:6px 0}
.langs{display:flex;flex-wrap:wrap;gap:4px 6px;margin-bottom:12px}
.langs a,.langs span{padding:6px 10px;border-radius:999px;border:1px solid var(--line);text-decoration:none;font-size:13px}
.langs span{background:var(--ink);color:var(--bg);border-color:var(--ink)}
@media (hover:hover){.daynav a:hover{background:var(--card)}.row-link:hover{background:var(--bg)}.ask:hover{background:var(--bg);color:var(--gold)}}
.cal{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;margin-bottom:14px}
.cal-head{display:flex;align-items:center;justify-content:space-between;height:32px;margin-bottom:6px}
.cal-head b{flex:1;text-align:center;font-size:15px}
.cal-head a{width:32px;height:32px;display:grid;place-items:center;border-radius:50%;text-decoration:none;font-size:22px;color:var(--muted)}
.cal-head a:hover{background:var(--bg)}
.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center}
.wd{font-size:11px;color:var(--muted);padding:4px 0}
.wd.we{color:var(--gold)}
.cell{position:relative;aspect-ratio:1;display:grid;place-items:center;border-radius:10px;font-size:13px;text-decoration:none;font-variant-numeric:tabular-nums}
.cell:hover{background:var(--bg)}
.cell.past{color:var(--muted);opacity:.6}
.cell.today{box-shadow:inset 0 0 0 1.5px var(--gold);font-weight:700}
.cell.sel{background:var(--ink);color:var(--bg);opacity:1}
.cell i{position:absolute;bottom:4px;left:50%;transform:translateX(-50%);width:5px;height:5px;border-radius:50%;background:var(--live)}
.cell.has-budo i{background:var(--budo)}
.cell.has-concert.has-budo i{background:linear-gradient(90deg,var(--live) 50%,var(--budo) 50%)}
.cell.sel i{box-shadow:0 0 0 1.5px var(--bg)}
.legend{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);margin:0 4px}
.legend .k{width:8px;height:8px;border-radius:50%;background:var(--live)}
.legend .k.budo{background:var(--budo);margin-left:10px}
@media (min-width:960px){
  main,.top{max-width:none}
  .layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:40px;align-items:start}
  .sidebar{display:block;position:sticky;top:16px}
}
@media (max-width:420px){
  .hero-card{padding:14px;gap:12px;border-radius:16px}
  .hero-card img{width:64px;height:64px;border-radius:10px}
  .list a{padding:12px}
  .day{width:34px}
}
`;
