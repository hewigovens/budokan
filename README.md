# Budokan Today

What's on at Nippon Budokan (日本武道館) today: concerts and martial-arts tournaments, in English,
日本語, 简体中文, 繁體中文 and 한국어. Installable as a PWA.

**https://budokan.hewig.dev**

- Concerts come from enjoy-live.net and Eventernote, refreshed every 6 hours.
- Martial-arts events come from the official Budokan yearly schedule (updated by hand each April).
- `/api/events` serves the data as JSON; `/health` reports source status (503 when data is stale or a
  source has been failing for a day), suitable for an uptime monitor.

```sh
bun install
bun run dev    # http://localhost:8787
bun test
```

Pushes to `main` deploy to Cloudflare Workers via GitHub Actions. See [AGENTS.md](AGENTS.md) for architecture
and maintenance notes.
