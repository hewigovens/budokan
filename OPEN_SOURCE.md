# Open-source publication checklist

This repository is currently private. Adding a license does not make it public.

## Before changing visibility

- [ ] Audit **all Git history**, not just the current tree, for credentials, personal data, and sensitive deployment configuration. Rotate anything exposed; deleting it from HEAD is insufficient.
- [ ] Review GitHub Actions logs, artifacts, issues, and pull requests for sensitive information.
- [ ] Confirm ownership and redistribution rights for source files, artwork, icons, fixtures, and event descriptions.
- [ ] Review enjoy-live.net, Eventernote, and Nippon Budokan source terms and robots policies. Open-sourcing the scraper does not grant permission to scrape or republish their content.
- [ ] Review Eventernote event images separately. Linking to remote images does not establish reuse rights.
- [ ] Confirm Cloudflare credentials remain in GitHub secrets and use least-privilege permissions.
- [ ] Confirm public forks/PRs cannot access deployment credentials or trigger production deployments.
- [ ] Review public exposure of `/api/events` and `/health` (source status and errors).
- [ ] Run `bun install --frozen-lockfile && bun run typecheck && bun test`.
- [ ] Add a public-facing disclaimer that this project is unofficial and event details may change.
- [ ] Manually approve the repository visibility change after all checks pass.

## Data provenance

- Concert listings are parsed from enjoy-live.net and Eventernote.
- Martial-arts dates are manually transcribed from Nippon Budokan's annual schedule.
- Event images may be referenced from third-party servers.

The MIT license covers the original project code and materials owned by the contributor. It **does not** grant rights to third-party data, names, images, or other content.

## Operational notes

`wrangler.jsonc` includes public deployment identifiers and a custom domain. These are not credentials, but review them before publication. Do not commit `.dev.vars`, API tokens, or Cloudflare account secrets.

This checklist is not a legal opinion or a completed security audit.
