import type { BudokanEvent } from "./types";

const norm = (s = "") => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

function sameShow(a: BudokanEvent, b: BudokanEvent): boolean {
  if (a.date !== b.date) return false;
  const ah = norm(a.headline), bh = norm(b.headline);
  const at = ah + norm(a.title), bt = bh + norm(b.title);
  const aT = norm(a.title), bT = norm(b.title);
  return (
    (ah.length > 1 && bt.includes(ah)) ||
    (bh.length > 1 && at.includes(bh)) ||
    // Artist spelled differently (ヒメヒナ vs HIMEHINA) but the tour names overlap.
    (aT.length > 6 && bT.length > 6 && (aT.includes(bT) || bT.includes(aT)))
  );
}

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
    sources: [...new Set([...primary.sources, ...extra.sources])],
  };
}

export function mergeEvents(...lists: BudokanEvent[][]): BudokanEvent[] {
  const out: BudokanEvent[] = [];
  for (const ev of lists.flat()) {
    const i = out.findIndex((o) => o.kind === ev.kind && sameShow(o, ev));
    if (i >= 0) out[i] = combine(out[i], ev);
    else out.push(ev);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "99").localeCompare(b.start ?? "99"));
}
