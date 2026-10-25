# Budokan Today

An unofficial guide to what's on at Nippon Budokan (日本武道館): today's concerts and
martial-arts events, plus the upcoming schedule.

**[Open Budokan Today](https://budokan.hewig.dev)**

- Browse by day, check start times, and follow links to the original sources. All dates and times are JST.
- Share permanent event pages that stay available after an event leaves the upcoming schedule.
- Switch between English, 日本語, 简体中文, 繁體中文, and 한국어.
- Use light or dark mode, install it as a PWA, and view previously loaded pages offline.

## Data and updates

Concert listings come from [enjoy-live.net](https://schedule.enjoy-live.net/schedule.php?hall_id=3)
and [Eventernote](https://www.eventernote.com/places/3/events), refreshed every six hours and
merged to combine artist names, tour titles, and times. Martial-arts events come from the
[official Budokan annual schedule](https://www.nipponbudokan.or.jp/shinkoujigyou/gyouji_08),
transcribed into [src/budo.ts](src/budo.ts) and updated each April.

Event pages include the details available from those sources. Unknown optional fields,
including ticket prices, are omitted from structured data; some non-critical Search Console
suggestions may remain. Third-party event images are disabled. Check the source listing
before making plans.

## Local development

The app is a TypeScript Cloudflare Worker with server-rendered HTML, Workers KV storage,
and no runtime dependencies. You'll need Bun; Wrangler is included as a development dependency.

```sh
bun install --frozen-lockfile
bun run dev
```

Open [localhost:8787](http://localhost:8787). Development uses local KV storage; the first
request fetches event data if the store is empty. To trigger another refresh:

```sh
curl http://localhost:8787/__scheduled
```

Use `bun run dev:lan` to test from a phone on the same network. Before committing changes:

```sh
bun run typecheck
bun test
```

Parser fixtures use fictional entries. See [AGENTS.md](AGENTS.md) for source maintenance,
localization, caching, and repository conventions.

## Routes

| Route | Response |
| --- | --- |
| `/` | Today's schedule; use `?date=YYYY-MM-DD` to browse another day. |
| `/events/<id>/` | One event, with a permanent URL and event structured data. |
| `/api/events` | Public listing JSON, excluding internal diagnostics and images. |
| `/health` | Aggregate `status` and `updatedAt`; HTTP 503 when unhealthy. |
| `/sitemap.xml` | Schedule URLs in all five languages. |
| `/sitemap-events.xml` | Event URLs in all five languages, including archived events. |

Schedule and event pages accept a `?lang=` parameter: `en`, `ja`, `zh-Hans`, `zh-Hant`, or
`ko`. Without an explicit language, the app uses the saved preference or the browser's language.

## Deployment

Pushes to `main` run tests and deploy to Cloudflare Workers through GitHub Actions.
Deployment is restricted to `hewigovens/budokan` and uses the `production` environment.
It requires a `CLOUDFLARE_API_TOKEN` secret and a `CLOUDFLARE_ACCOUNT_ID` variable.

The Worker name, KV namespace, custom domain, and six-hour cron schedule are configured in
[wrangler.jsonc](wrangler.jsonc). For a separate deployment, configure your own Worker,
KV namespace, and domain before running `bun run deploy`.

## Purpose and rights concerns

Budokan Today is an independent, non-commercial information project. Event information is
provided for reference, with links to the original sources. Third-party names and content
remain the property of their respective rights holders and are not covered by this
repository's MIT license.

If you are a rights holder and believe content on this site infringes your rights, please
contact the maintainer via the [GitHub profile](https://github.com/hewigovens), identifying
the affected content and your rights. We will promptly review the request and remove or
disable access to the disputed content while it is reviewed.

This statement describes how this site is operated; it does not restrict commercial use of
original code under the MIT license or claim permission to reuse third-party content. See
[OPEN_SOURCE.md](OPEN_SOURCE.md) for outstanding publication checks.
