import { BUDO_VALID_UNTIL } from "./budo";
import type { Snapshot } from "./types";

// Cron runs every 6h; allow one missed run before calling the data stale.
const STALE_AFTER_H = 13;
// A source failing once is a warning; failing for a day is an error worth alerting on.
const SOURCE_DOWN_AFTER_H = 24;

export interface Health {
  status: "ok" | "warning" | "error";
  updatedAt: string;
  ageHours: number;
  problems: string[];
  warnings: string[];
  sources: Snapshot["sources"];
}

const hoursSince = (iso: string | undefined, now: number) => (iso ? (now - Date.parse(iso)) / 3600_000 : Infinity);

export function checkHealth(snap: Snapshot, now: number, today: string): Health {
  const problems: string[] = [];
  const warnings: string[] = [];
  const ageHours = hoursSince(snap.updatedAt, now);

  if (ageHours > STALE_AFTER_H) problems.push(`Last refresh was ${Math.round(ageHours)}h ago; the cron trigger may not be running.`);

  for (const s of snap.sources) {
    if (s.ok) continue;
    const down = hoursSince(s.lastSuccessAt, now);
    const since = s.lastSuccessAt ? `last success ${Math.round(down)}h ago` : "no success on record";
    (down > SOURCE_DOWN_AFTER_H ? problems : warnings).push(`${s.name}: ${s.error} (${since})`);
  }

  if (today > BUDO_VALID_UNTIL) problems.push(`Martial-arts schedule ended ${BUDO_VALID_UNTIL}; add the new year's PDF to src/budo.ts.`);

  return {
    status: problems.length ? "error" : warnings.length ? "warning" : "ok",
    updatedAt: snap.updatedAt,
    ageHours: Math.round(ageHours * 10) / 10,
    problems,
    warnings,
    sources: snap.sources,
  };
}
