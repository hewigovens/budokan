export type Kind = "concert" | "budo";

export interface BudokanEvent {
  id?: string; // Assigned once when published; retained in the event archive.
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
  sourceUrls?: string[];
  sources: string[];
}

export interface PublishedEvent extends BudokanEvent {
  id: string;
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

export interface PublishedSnapshot extends Snapshot {
  events: PublishedEvent[];
}
