import { createSignal } from "solid-js";

export interface RawEvent {
  ts: number;
  source: "sse" | "app";
  summary: string;
}

const CAP = 100;

const [version, setVersion] = createSignal(0);
const entries: RawEvent[] = [];

/**
 * In-memory ring of recent raw events for the developer viewer.
 * Callers gate on dev mode; this module never touches storage.
 */
export function logRawEvent(source: RawEvent["source"], summary: string): void {
  entries.push({ ts: Date.now(), summary: summary.slice(0, 160), source });
  if (entries.length > CAP) entries.splice(0, entries.length - CAP);
  setVersion((v) => v + 1);
}

/** Newest-first snapshot. Reading `changes()` subscribes in Solid. */
export function listRawEvents(): RawEvent[] {
  version();
  return [...entries].reverse();
}

export function clearRawEvents(): void {
  entries.length = 0;
  setVersion((v) => v + 1);
}
