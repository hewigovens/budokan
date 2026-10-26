# AGENTS.md

Budokan Today: a Cloudflare Worker that shows what's on at Nippon Budokan (日本武道館) today.
Live at https://budokan.hewig.dev (also https://budokan-today.hewigovens.workers.dev).

## Commands

```sh
bun install
bun run dev          # wrangler dev on http://localhost:8787 (--test-scheduled)
bun run dev:lan      # same, reachable from a phone on the LAN
curl localhost:8787/__scheduled   # run the cron refresh locally
bun test             # parser, merge, i18n, health tests (fixtures in test/fixtures/)
bun run typecheck    # tsc --noEmit
bun run deploy       # manual wrangler deploy (normally CI does this)
bunx wrangler tail   # live logs from production
```

Run `bun run typecheck && bun test` before finishing any change.

## How it works

- A cron trigger (every 6h) calls `refresh()` in `src/index.ts`: scrape concerts, merge with the static
  martial-arts list, store one JSON snapshot in KV (`EVENTS`, key `snapshot`).
- `GET /` reads the snapshot and renders HTML server-side (`src/render.ts`). No client framework; the only
  client JS is service-worker registration and the offline banner.
- Each refresh assigns stable event IDs and stores all published records in KV (`event-archive`).
  `GET /events/<id>/` serves one event, including after it leaves the rolling snapshot. Existing snapshots
  migrate on first read. `GET /sitemap-events.xml` lists event pages in all five locales.
- Date-filtered calendar views use `noindex, follow`; calendar links use `nofollow` to avoid
  an unbounded crawl. Home and event canonicals use explicit `?lang=` URLs matching the sitemaps.
  Keep date filters out of sitemaps and head language alternates.
- `GET /api/events` returns public event fields without diagnostics or images. `GET /health` returns aggregate status (503 on errors) for
  uptime monitors.
- Static files (icons, `manifest.webmanifest`, `sw.js`) are in `public/` and served by Workers assets.

## Layout

| Path | Purpose |
|---|---|
| `src/index.ts` | Routes, cron handler, refresh + fallback, locale pick |
| `src/dates.ts` | JST date helpers (`jstNow`, `addDays`, `addMonths`) |
| `src/scrape.ts` | enjoy-live.net and Eventernote fetch/parse (regex over HTML) |
| `src/merge.ts` | Combine source details and sort the schedule |
| `src/events.ts` | Event names, matching, stable identity and archive reconciliation |
| `src/html.ts` | Shared HTML escaping |
| `src/urls.ts` | Canonical site, event paths and localized URLs |
| `src/sitemap.ts` | Dynamic sitemap for archived event pages |
| `src/budo.ts` | Martial-arts schedule, hand-transcribed from the official yearly PDF |
| `src/health.ts` | Staleness / source-failure / expiry checks |
| `src/render.ts` | HTML rendering, CJK line breaking and mini calendar |
| `src/seo.ts` | Canonical URLs, language alternates, share tags and JSON-LD |
| `src/styles.ts` | Page CSS and per-language font stacks |
| `src/icons.ts` | Inline SVG icons (logo, sparkle, pin, globe) |
| `src/i18n.ts` | UI strings for en, ja, zh-Hans, zh-Hant, ko |
| `public/` | Static assets: icons, `manifest.webmanifest`, `sw.js` (network-first pages, cache-first icons), `_headers`, `robots.txt`, `sitemap.xml` |
| `.github/workflows/deploy.yml` | CI: typecheck + test on PRs and main; deploy on push to main |

## Data sources

- Concerts: `schedule.enjoy-live.net` (artist + tour name) and `eventernote.com` (times).
  Budokan's official site does not publish concerts.
- Martial arts: `https://www.nipponbudokan.or.jp/shinkoujigyou/gyouji_08` links a yearly PDF. Each April,
  transcribe the new PDF into `src/budo.ts` and bump `BUDO_VALID_UNTIL`. `/health` errors once it expires.
- A source returning 0 events is treated as a failure (layout change). If a parser breaks, reproduce the relevant structure with fictional entries
  in `test/fixtures/`; do not commit downloaded pages, CSRF values, or third-party artwork.
- Keep subrequests per refresh under 50 (Workers free plan); image requests are disabled pending rights clearance.

## Conventions

- TypeScript, no runtime dependencies. Match the existing terse style; comments explain why, not what.
- All dates are JST `YYYY-MM-DD` strings; use `jstNow()` rather than local time.
- Any new UI string must be added to all five locales in `src/i18n.ts` (the `Strings` type enforces it).
- Event names are Japanese: render them with `cjk()` and `lang="ja"` so line breaks and glyphs are right.
- Escape everything interpolated into HTML (`esc()` / `cjk()`).
- Colors are CSS custom properties on `:root` with a dark-mode override; keep both in sync.
- If you change cached assets in `public/`, bump `VERSION` in `public/sw.js`. Icons and `og.png` are served with a 1-year
  immutable `Cache-Control` (`public/_headers`), so a changed image needs a new filename.
- Text must meet WCAG AA contrast (4.5:1) against `--bg` and `--card` in both themes; avoid `opacity` on text.

## Deployment

Pushing `main` to GitHub runs CI and deploys with `wrangler deploy` (needs the `CLOUDFLARE_API_TOKEN`
secret and `CLOUDFLARE_ACCOUNT_ID` variable on the repo). The custom domain `budokan.hewig.dev` is declared
in `wrangler.jsonc` under `routes`. KV and the cron trigger are also in `wrangler.jsonc`.

## Version control

This repo uses [jj](https://jj-vcs.github.io/jj/) colocated with git; remote is
`git@github.com:hewigovens/budokan.git`, main bookmark `main`.

```sh
jj st                       # status
jj describe -m "message"    # describe the working-copy change
jj new                      # start the next change
jj bookmark set main -r @-  # move main to the finished change
jj git push --bookmark main  # this deploys to production via CI
```

Pushing `main` deploys, so don't push or run `bun run deploy` without the user asking.
