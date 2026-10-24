import { addDays, minutesSinceMidnight } from "./dates";
import { eventName } from "./events";
import { esc } from "./html";
import { LOCALES, STRINGS, type Locale } from "./i18n";
import type { PublishedEvent } from "./types";
import { eventPath, pageUrl, SITE } from "./urls";

interface SeoProps {
  locale: Locale;
  title: string;
  description: string;
  date?: string;
  langInUrl?: boolean;
  event?: PublishedEvent;
}

const VENUE = {
  "@type": "Place",
  name: "日本武道館 (Nippon Budokan)",
  address: { "@type": "PostalAddress", streetAddress: "北の丸公園2-3", addressLocality: "千代田区", addressRegion: "東京都", postalCode: "102-8321", addressCountry: "JP" },
  geo: { "@type": "GeoCoordinates", latitude: 35.6933, longitude: 139.7499 },
};

const OG_LOCALE: Record<Locale, string> = { en: "en_GB", ja: "ja_JP", "zh-Hans": "zh_CN", "zh-Hant": "zh_TW", ko: "ko_KR" };
const at = (date: string, time: string) => `${date}T${time.padStart(5, "0")}:00+09:00`;

function eventNode(event: PublishedEvent, url: string, description: string) {
  const endDate = event.start && event.end && minutesSinceMidnight(event.end) < minutesSinceMidnight(event.start) ? addDays(event.date, 1) : event.date;
  let type = "SportsEvent";
  if (event.kind === "concert") type = "MusicEvent";
  else if (event.sport === "Calligraphy" || event.sport === "New Year ceremony") type = "Event";
  return {
    "@type": type,
    "@id": `${SITE}${eventPath(event.id)}#event`,
    name: eventName(event),
    description,
    url,
    startDate: event.start ? at(event.date, event.start) : event.date,
    ...(event.end && { endDate: at(endDate, event.end) }),
    ...(event.open && { doorTime: at(event.date, event.open) }),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: VENUE,
    ...(event.kind === "concert" && { performer: { "@type": "PerformingGroup", name: event.headline } }),
    ...(event.organizer && { organizer: { "@type": "Organization", name: event.organizer } }),
  };
}

export function renderSeo({ locale, title, description, date, langInUrl = false, event }: SeoProps): string {
  const path = event ? eventPath(event.id) : "/";
  const alternates = LOCALES.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(pageUrl(path, l, date))}">`).join("\n");
  // Language-negotiated URLs are x-default and canonicalize to themselves.
  const xDefault = `${SITE}${path}${date ? `?date=${date}` : ""}`;
  const self = langInUrl ? pageUrl(path, locale, date) : xDefault;
  // Event rich results belong on individual event pages; the rolling schedule is a collection.
  const node = event ? eventNode(event, self, description) : {
    "@type": "CollectionPage",
    name: title,
    description,
    url: self,
    inLanguage: locale,
    image: `${SITE}/og.png`,
    about: VENUE,
  };
  // Escape '<' so source text cannot close the script element.
  const json = JSON.stringify({ "@context": "https://schema.org", ...node }).replace(/</g, "\\u003c");
  return `<link rel="canonical" href="${esc(self)}">
${alternates}
<link rel="alternate" hreflang="x-default" href="${esc(xDefault)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(STRINGS[locale].brand)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(self)}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(STRINGS[locale].brand)}">
<meta property="og:locale" content="${OG_LOCALE[locale]}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${json}</script>`;
}
