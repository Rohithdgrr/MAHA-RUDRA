import { createStore } from "solid-js/store";
import type { Memory } from "./types";

export interface TracedMemory {
  id: string;
  category: string;
  key: string;
  label: string;
}

const [state, setState] = createStore<Record<string, TracedMemory[]>>({});

/** Snapshot which memories were injected for a session (for the "used" chip). */
export function traceInjection(sessionId: string, memories: Memory[]): void {
  if (!sessionId) return;
  setState(sessionId, memories.map((m) => ({ id: m.id, category: m.category, key: m.key, label: m.key })));
}

export function getTrace(sessionId: string | undefined): TracedMemory[] {
  if (!sessionId) return [];
  return state[sessionId] ?? [];
}

export function traceState(): Record<string, TracedMemory[]> {
  return state;
}
