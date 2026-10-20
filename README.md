# Budokan Today

What's on at Nippon Budokan (日本武道館) today — a Cloudflare Worker.

- Concerts: scraped from enjoy-live.net and Eventernote every 6h (cron), merged/deduped, stored in KV.
- Martial-arts events: transcribed from the official yearly PDF in `src/budo.ts` (update each April).

```sh
bun install
bun run dev        # http://localhost:8787  (curl localhost:8787/__scheduled to force a refresh)
bun run dev:lan    # same, reachable from your phone on the same Wi-Fi
bun test
bun run deploy     # KV namespace is auto-provisioned on first deploy
```

Static files (icons, manifest, service worker) live in `public/`.

Routes: `/` (`?date=YYYY-MM-DD` for other days, `?lang=en|ja|zh-Hans|zh-Hant|ko`), `/api/events` (JSON), `/health` (source status; 503 when data is stale or a source has failed for 24h, so you can point an uptime monitor at it).

UI language follows `?lang=` (remembered in a cookie), else the browser's Accept-Language. Strings live in `src/i18n.ts`.
Event names are Japanese and tagged `lang="ja"`; `cjk()` in `src/render.ts` adds line breaks only at word boundaries.
