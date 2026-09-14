import type { JsonValue, Memory, MemoryCategory, MemorySource, MemoryStatus } from "./types";

/** Input for creating a memory (server-generated fields omitted). */
export interface NewMemoryInput {
  category: MemoryCategory;
  key: string;
  value: JsonValue;
  confidence?: number;
  sensitive?: boolean;
  source?: Partial<MemorySource>;
}

/** Input for editing value/key/category of an existing memory. */
export interface UpdateMemoryInput {
  category?: MemoryCategory;
  key?: string;
  value?: JsonValue;
  sensitive?: boolean;
}

/**
 * Single seam for memory persistence. Phase 1 ships the localStorage
 * impl; IndexedDB / SQLite adopt this interface later without UI churn.
 */
export interface MemoryStore {
  list(): Promise<Memory[]>;
  get(id: string): Promise<Memory | undefined>;
  /** Insert; supersedes the active (category,key) holder when status is active. */
  upsert(input: NewMemoryInput): Promise<Memory>;
  /** Insert as pending for review; never supersedes. Phase 2/3 review queue. */
  propose(input: NewMemoryInput): Promise<Memory>;
  /** Approve a pending item: activates it, archiving any active holder. */
  approve(id: string): Promise<Memory>;
  /** Bump lastConfirmedAt without creating a record (dedupe equal-value case). */
  confirm(id: string): Promise<Memory>;
  update(id: string, patch: UpdateMemoryInput): Promise<Memory>;
  setStatus(id: string, status: MemoryStatus): Promise<Memory>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
}

export function slugify(name: string): string {
  const base = normalizeKey(name).replace(/\./g, "-");
  return base || `item-${Date.now().toString(36)}`;
}
