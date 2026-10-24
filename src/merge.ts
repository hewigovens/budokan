import type { BudokanEvent } from "./types";
import { eventUrls, sameShow } from "./events";

// enjoy-live has clean artist/tour names; eventernote adds times and images.
function combine(primary: BudokanEvent, extra: BudokanEvent): BudokanEvent {
  return {
    ...extra,
    ...Object.fromEntries(Object.entries(primary).filter(([, v]) => v !== undefined)),
    open: primary.open ?? extra.open,
    start: primary.start ?? extra.start,
    end: primary.end ?? extra.end,
    image: primary.image ?? extra.image,
    url: extra.url ?? primary.url,
    sourceUrls: [...new Set([...eventUrls(primary), ...eventUrls(extra)])],
    sources: [...new Set([...primary.sources, ...extra.sources])],
  };
}

export function mergeEvents(...lists: BudokanEvent[][]): BudokanEvent[] {
  const out: BudokanEvent[] = [];
  for (const ev of lists.flat()) {
    const i = out.findIndex((o) => sameShow(o, ev));
    if (i >= 0) out[i] = combine(out[i], ev);
    else out.push(ev);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "99").localeCompare(b.start ?? "99"));
}
