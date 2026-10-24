import { LOCALES } from "./i18n";
import type { PublishedEvent } from "./types";
import { eventPath, pageUrl, SITE } from "./urls";

export function eventSitemap(events: PublishedEvent[]): string {
  const entries = events.flatMap((event) => {
    const path = eventPath(event.id);
    const alternates = LOCALES.map((locale) => `<xhtml:link rel="alternate" hreflang="${locale}" href="${pageUrl(path, locale)}"/>`).join("");
    return LOCALES.map((locale) => `<url><loc>${pageUrl(path, locale)}</loc>${alternates}<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${path}"/></url>`);
  });
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries.join("")}</urlset>`;
}
