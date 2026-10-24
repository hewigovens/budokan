// Per-language font stacks so Han characters get the right regional glyphs
// (event names are Japanese, so they're tagged lang="ja" whatever the UI language).
const FONT_LATIN = `-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto`;
const FONT_JA = `"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic",Meiryo,"Noto Sans CJK JP","Noto Sans JP"`;
const FONT_SC = `"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC"`;
const FONT_TC = `"PingFang TC","Microsoft JhengHei","Noto Sans CJK TC","Noto Sans TC"`;
const FONT_KR = `"Apple SD Gothic Neo","Malgun Gothic","Noto Sans CJK KR","Noto Sans KR"`;

export const CSS = `
:root{--bg:#f5f1e8;--card:#fffdf8;--ink:#1d1d26;--muted:#6b6862;--line:#e3ddd0;--gold:#856524;--live:#3c4bb0;--live-bg:#e8eafb;--budo:#9c2f2a;--budo-bg:#f7e5e2;--ok:#1f7a4a;--ok-bg:#dff3e7}
@media (prefers-color-scheme:dark){:root{--bg:#14141a;--card:#1d1d26;--ink:#f1ede4;--muted:#9a968e;--line:#2d2c36;--gold:#d6b25e;--live:#a9b3ff;--live-bg:#262b4d;--budo:#f0a39c;--budo-bg:#46221f;--ok:#7fdca5;--ok-bg:#1c3a2a}}
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
.hero-card{display:flex;gap:14px;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;text-decoration:none;margin-bottom:10px}
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
.offline{margin:0 0 12px;padding:8px 12px;border-radius:10px;background:var(--budo-bg);color:var(--budo);font-size:13px;text-align:center}
footer{margin-top:40px;font-size:12px;color:var(--muted)}
footer p{margin:6px 0}
footer .warn{color:var(--budo)}
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
.cell.past{color:var(--muted)}
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
  .row-link{padding:12px 0 12px 12px}
  .day{width:34px}
}
`;

