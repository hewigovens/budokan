# Open-source publication gate

Review date: 2026-10-24. **Keep PR #3 Draft and the repository Private. Do not merge or publish automatically.** MIT applies only to original material whose rights the contributor owns; it does not license third-party listings, schedules, images or historical fixtures.

## Verified

- Baseline PR head: `6ac0b5f5d49d48c722193f8aff7231059d32437a`; main: `f30cba8f12e0b077c394438e1c947fde6f653865`.
- GitHub API enumeration covered all 10 advertised refs (four branch refs and six PR head/merge refs), 15 reachable commits back to the root, and 66 unique blobs. All trees were non-truncated. Read all 61 text blobs; five PNG blobs were inventoried, not decoded or scanned. This was API enumeration, not a mirror clone; unreachable/deleted refs and objects are outside coverage.
- Pattern scanning of those text blobs and all 11 available Actions job logs found no matches for private keys, GitHub/AWS/Google token formats, JWTs, literal credential assignments, URL credentials or literal Cloudflare API tokens. Follow-up credential-keyword inspection found an HTML CSRF value in the historical Eventernote fixture. It is a captured website/session artifact, not evidence of a Cloudflare/GitHub credential leak. Its validity/session association has not been tested. No secret values are reproduced here.
- All 11 existing workflow runs were inspected; each returned an empty artifact list. PR runs skipped deployment. Logs mask GitHub/Cloudflare token inputs, but disclose deployment identifiers and operational URLs. Masking and pattern scans are not proof that every possible secret is absent. Deleted/expired runs or artifacts cannot be assessed.
- Workflow actions were already SHA-pinned and the job token already had `contents: read`; no `pull_request_target`, `workflow_run`, or self-hosted runner is configured.
- `wrangler.jsonc` contains production KV/domain/Worker identifiers, not demonstrated API credentials. Original `.dev.vars` was ignored.
- `src/i18n.ts` already has the unofficial-site disclaimer; it has not been duplicated.

## Fixed in this PR

- Replace both downloaded HTML fixtures with original, minimal fictional test inputs. Remove captured CSRF markup, trackers, real listings and third-party S3 image URLs from the current fixtures. Parser tests still cover dates, entities, actors, times and cross-source merging.
- Stop parsing and HEAD-fetching third-party event images. Ignore existing cached images in HTML, Event JSON-LD and `/api/events`; removing only the scraper would leave historical KV images visible. Existing KV data is not deleted by this PR.
- `/health` intentionally remains public and returns only `status` and `updatedAt`, preserving 503 on errors and `no-store`. Detailed source error strings stay out of the response.
- `/api/events` intentionally remains public with CORS `*`, returning `updatedAt` and explicitly selected listing fields. Internal source status/errors and image URLs are excluded. Public listing reuse is still subject to the rights gate below; CORS is not authorization.
- Separate unprivileged tests from deployment. Deployment requires successful tests, the exact `hewigovens/budokan` repository, a `push`, and `refs/heads/main`; it uses the `production` environment. PR tests do not reference Cloudflare secrets. Checkouts disable persisted credentials. Existing pinned action versions are retained.
- Ignore `.env`, `.env.*` and `.dev.vars.*`; document synthetic-only fixture maintenance.
- Remove the hero event card's thick colored left border for both concert and budo cards; retain the category badge and uniform rounded border.

## Source provenance and unresolved rights

| Material | Evidence / status | Safe alternative |
| --- | --- | --- |
| Eventernote listings and historical HTML | [Terms](https://www.eventernote.com/pages/termsofservice), checked 2026-10-24, prohibit third-party rights infringement and place responsibility for uploaded images on users. No affirmative scraping or redistribution license was found in those terms. | Synthetic fixtures implemented. Obtain permission for live listing reuse, or use an operator-owned/authorized event feed. |
| Eventernote/S3 event images | Third-party URLs were embedded in old fixtures and emitted by scraper; no image permission established. | Image fetching/rendering disabled, including old KV snapshots. |
| enjoy-live listings and historical HTML | [Source](https://schedule.enjoy-live.net/); no affirmative reuse grant established. | Synthetic fixtures implemented; replace live source with authorized/independently maintained event data if permission cannot be confirmed. |
| `src/budo.ts` schedule | Transcribed from [official annual PDF](https://www.nipponbudokan.or.jp/pdf/shinkoujigyou/sched_R8/r8_sched.pdf), as stated in source. Dates/factual nature alone do not settle the rights of the copied selection/compilation. No redistribution clearance established. | Before release, obtain clearance or replace the embedded compilation with operator-supplied authorized data outside the source tree and a synthetic example. Current schedule is retained pending that decision; it is a blocker. |
| Icons, logo, PNGs and Open Graph image | SVG source and five tracked PNGs inventoried; authorship/license not established by commit presence. | Owner confirms creation/source rights, or replace with demonstrably original assets and check history. |

Robots files for Eventernote, schedule.enjoy-live.net and Nippon Budokan could not be retrieved through the available research tool. Treat robots status as unknown, not permission. A robots allowance would not establish redistribution rights either.

## Required human / administrator checks before publication

- [ ] Resolve live source and embedded schedule reuse rights above. The MIT file is not clearance.
- [ ] Resolve historical downloaded fixtures (including CSRF markup and image URLs) and any unlicensed assets. HEAD replacement does not remove them from old commits or PR refs. Choose authorized retention, a coordinated history cleanup, or a clean public source export; do not rewrite shared history without an explicit plan/approval. A clean export must exclude the unresolved schedule/assets too.
- [ ] Run an established full-history credential scanner (for example Gitleaks/TruffleHog) on a full mirror including tags/PR refs; review binary metadata and commit metadata. The bounded pattern scan above is not a substitute for this release gate. Rotate any real credentials found and address old logs/refs; deletion alone is insufficient.
- [ ] Verify branch protection/rulesets and review requirements. The connection returned 403 for main protection. Actions permissions, fork approval settings and environment configuration were unavailable through the connector.
- [ ] Configure `production` with required reviewers and main-only deployment branches; move the Cloudflare token to that environment and remove any duplicate repository-level deployment secret. Merely naming an environment in YAML does not create protection rules. A maintainer-controlled PR can modify YAML; server-side protections are needed.
- [ ] Verify Cloudflare token least privilege, resource/account scope, expiry and access to only the intended Worker/KV/zone. Token permissions cannot be inferred from its name. Verify other deployment paths (Cloudflare dashboard Git integrations, API tokens, local deploy access) separately.
- [ ] Review remaining GitHub issues/comments, binary assets, inaccessible/deleted Actions material, and owner privacy preferences for public account/domain identifiers. Do not publish raw logs as audit evidence.
- [ ] Approve the deliberately public API fields and `/health` response change with any monitoring/API consumers. Source errors still exist in private KV and Worker logs; review their retention/access independently.
- [ ] Confirm forks use their own KV namespace and domain before deployment. The repository guard blocks this workflow from deploying in a fork, but manual Wrangler commands still use checked-in production identifiers.
- [ ] Final manual approval to merge and change visibility, after the above gates pass.

## Validation

- `bun install --frozen-lockfile`: passed with Bun 1.4.4.
- `bun run typecheck`: passed.
- `bun test`: 15 passed, 0 failed (54 assertions), including public error redaction and previously cached image suppression.
- No production deployment, KV mutation, history rewrite, merge or visibility change performed.
- Visual QA not completed: Browser plugin unavailable; installed Playwright cannot launch because its Chromium executable is absent. CSS change is limited to deleting the thick left border and category border override. Verify mobile Safari and desktop in light/dark mode before merging.
