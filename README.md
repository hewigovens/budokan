# Budokan Today

What's on at Nippon Budokan (日本武道館) today: concerts and martial-arts tournaments, in English,
日本語, 简体中文, 繁體中文 and 한국어. Installable as a PWA.

**https://budokan.hewig.dev**

- Concerts come from enjoy-live.net and Eventernote, refreshed every 6 hours.
- Martial-arts events come from the official Budokan yearly schedule (updated by hand each April).
- `/api/events` serves the data as JSON; `/health` reports aggregate status (503 when data is stale or a
  source has been failing for a day), suitable for an uptime monitor.

```sh
bun install
bun run dev    # http://localhost:8787
bun test
```

Pushes to `main` deploy to Cloudflare Workers via GitHub Actions. See [AGENTS.md](AGENTS.md) for architecture
and maintenance notes.

## Purpose and rights concerns

Budokan Today is an independent, non-commercial information project. Event information is provided for reference, with links to the original sources. Third-party names and content remain the property of their respective rights holders and are not covered by this repository's MIT license.

If you are a rights holder and believe content on this site infringes your rights, please contact the maintainer via the [GitHub profile](https://github.com/hewigovens), identifying the affected content and your rights. We will promptly review the request and remove or disable access to the disputed content while it is reviewed.

This statement describes how this site is operated; it does not restrict commercial use of original code under the MIT license or claim permission to reuse third-party content. See [OPEN_SOURCE.md](OPEN_SOURCE.md) for outstanding publication checks.
