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
- `GET /api/events` returns the snapshot. `GET /health` returns per-source status (503 on errors) for
  uptime monitors.
- Static files (icons, `manifest.webmanifest`, `sw.js`) are in `public/` and served by Workers assets.

## Layout

| Path | Purpose |
|---|---|
| `src/index.ts` | Routes, cron handler, refresh + fallback, locale pick |
| `src/dates.ts` | JST date helpers (`jstNow`, `addDays`, `addMonths`) |
| `src/scrape.ts` | enjoy-live.net and Eventernote fetch/parse (regex over HTML) |
| `src/merge.ts` | Dedupe the same show across sources |
| `src/budo.ts` | Martial-arts schedule, hand-transcribed from the official yearly PDF |
| `src/health.ts` | Staleness / source-failure / expiry checks |
| `src/render.ts` | HTML rendering, CJK line breaking, mini calendar |
| `src/styles.ts` | Page CSS and per-language font stacks |
| `src/icons.ts` | Inline SVG icons (logo, sparkle, pin, globe) |
| `src/i18n.ts` | UI strings for en, ja, zh-Hans, zh-Hant, ko |
| `public/` | Static assets: icons, `manifest.webmanifest`, `sw.js` (network-first pages, cache-first icons) |
| `.github/workflows/deploy.yml` | CI: typecheck + test on PRs and main; deploy on push to main |

## Data sources

- Concerts: `schedule.enjoy-live.net` (artist + tour name) and `eventernote.com` (times, images).
  Budokan's official site does not publish concerts.
- Martial arts: `https://www.nipponbudokan.or.jp/shinkoujigyou/gyouji_08` links a yearly PDF. Each April,
  transcribe the new PDF into `src/budo.ts` and bump `BUDO_VALID_UNTIL`. `/health` errors once it expires.
- A source returning 0 events is treated as a failure (layout change). If a parser breaks, save a fresh copy
  of the page to `test/fixtures/` and fix the regex in `src/scrape.ts` against it.
- Keep subrequests per refresh under 50 (Workers free plan); see the image HEAD-check cap in `scrape.ts`.

## Conventions

- TypeScript, no runtime dependencies. Match the existing terse style; comments explain why, not what.
- All dates are JST `YYYY-MM-DD` strings; use `jstNow()` rather than local time.
- Any new UI string must be added to all five locales in `src/i18n.ts` (the `Strings` type enforces it).
- Event names are Japanese: render them with `cjk()` and `lang="ja"` so line breaks and glyphs are right.
- Escape everything interpolated into HTML (`esc()` / `cjk()`).
- Colors are CSS custom properties on `:root` with a dark-mode override; keep both in sync.
- If you change cached assets in `public/`, bump `VERSION` in `public/sw.js`.

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
