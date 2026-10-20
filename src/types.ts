export type Kind = "concert" | "budo";

export interface BudokanEvent {
  date: string; // YYYY-MM-DD, JST
  kind: Kind;
  headline: string; // artist or tournament name
  title?: string; // tour name / sub-title
  sport?: string; // English discipline for budo events
  organizer?: string;
  open?: string; // HH:MM doors
  start?: string;
  end?: string;
  image?: string;
  url?: string;
  sources: string[];
}

export interface SourceStatus {
  name: string;
  ok: boolean;
  count: number;
  error?: string;
  checkedAt: string;
  lastSuccessAt?: string;
}

export interface Snapshot {
  updatedAt: string;
  events: BudokanEvent[];
  sources: SourceStatus[];
}
