import type { Locale } from "./i18n";

export const SITE = "https://budokan.hewig.dev";
export const eventPath = (id: string) => `/events/${encodeURIComponent(id)}/`;
export const pagePath = (path: string, locale: Locale, date?: string) => `${path}?lang=${locale}${date ? `&date=${date}` : ""}`;
export const schedulePath = (locale: Locale, date: string, today: string) => pagePath("/", locale, date === today ? undefined : date);
export const pageUrl = (path: string, locale: Locale, date?: string) => `${SITE}${pagePath(path, locale, date)}`;
