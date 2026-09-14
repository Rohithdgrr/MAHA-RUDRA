import { logger } from "../utils/logger";
import type { Memory, MemoryStatus } from "./types";
import { createMemoryId, isMemoryCategory, isMemoryStatus } from "./types";
import type { MemoryStore, NewMemoryInput, UpdateMemoryInput } from "./store";
import { normalizeKey } from "./store";

export const MEMORY_STORAGE_KEY = "rudra.memory.v1";

function now(): number {
  return Date.now();
}

function manualSource(): Memory["source"] {
  return { sessionId: "manual", messageId: "manual", excerpt: "Entered manually in Settings", timestamp: now() };
}

/** Validate one persisted record; shared with the IndexedDB impl. */
export function sanitizeRecord(raw: unknown): Memory | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return undefined;
  if (!isMemoryCategory(r.category)) return undefined;
  if (typeof r.key !== "string" || !r.key.trim()) return undefined;
  if (!isMemoryStatus(r.status)) return undefined;
  const num = (v: unknown, fb: number) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
  const src = (r.source ?? {}) as Record<string, unknown>;
  return {
    id: r.id,
    category: r.category,
    key: r.key,
    value: (r.value ?? "") as Memory["value"],
    confidence: Math.min(1, Math.max(0, num(r.confidence, 1))),
    status: r.status,
    sensitive: r.sensitive === true,
    source: {
      sessionId: typeof src.sessionId === "string" ? src.sessionId : "manual",
      messageId: typeof src.messageId === "string" ? src.messageId : "manual",
      excerpt: typeof src.excerpt === "string" ? src.excerpt : "",
      timestamp: num(src.timestamp, num(r.createdAt, now())),
    },
    createdAt: num(r.createdAt, now()),
    updatedAt: num(r.updatedAt, now()),
    lastConfirmedAt: num(r.lastConfirmedAt, num(r.updatedAt, now())),
    ...(typeof r.supersedes === "string" ? { supersedes: r.supersedes } : {}),
  };
}

/** Parse persisted payload; corrupt entries are dropped, never thrown. */
export function parseMemories(raw: string | null | undefined): Memory[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: Memory[] = [];
    for (const item of parsed) {
      const m = sanitizeRecord(item);
      if (m) out.push(m);
    }
    return out;
  } catch {
    return [];
  }
}

/** Web + Tauri-webview impl over localStorage. Async to match future IDB/SQLite. */
export class LocalStorageMemoryStore implements MemoryStore {
  private key: string;
  constructor(key = MEMORY_STORAGE_KEY) {
    this.key = key;
  }

  private read(): Memory[] {
    if (typeof window === "undefined") return [];
    try {
      return parseMemories(window.localStorage.getItem(this.key));
    } catch {
      return [];
    }
  }

  private write(all: Memory[]): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(this.key, JSON.stringify(all));
    } catch (err) {
      logger.warn(`Memory persist failed: ${(err as Error).message}`);
    }
  }

  async list(): Promise<Memory[]> {
    return this.read().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string): Promise<Memory | undefined> {
    return this.read().find((m) => m.id === id);
  }

  async upsert(input: NewMemoryInput): Promise<Memory> {
    const key = normalizeKey(input.key);
    if (!key) throw new Error("Memory key is required");
    const t = now();
    const all = this.read();
    const prev = all.find(
      (m) => m.status === "active" && m.category === input.category && m.key === key,
    );
    const mem: Memory = {
      id: createMemoryId(),
      category: input.category,
      key,
      value: input.value,
      confidence: Math.min(1, Math.max(0, input.confidence ?? 1)),
      status: "active",
      sensitive: input.sensitive === true,
      source: { ...manualSource(), ...(input.source ?? {}), timestamp: input.source?.timestamp ?? t },
      createdAt: t,
      updatedAt: t,
      lastConfirmedAt: t,
      ...(prev ? { supersedes: prev.id } : {}),
    };
    const next = all.map((m) =>
      prev && m.id === prev.id
        ? { ...m, status: "archived" as MemoryStatus, updatedAt: t }
        : m,
    );
    next.push(mem);
    this.write(next);
    return mem;
  }

  async propose(input: NewMemoryInput): Promise<Memory> {
    const key = normalizeKey(input.key);
    if (!key) throw new Error("Memory key is required");
    const t = now();
    const all = this.read();
    const mem: Memory = {
      id: createMemoryId(),
      category: input.category,
      key,
      value: input.value,
      confidence: Math.min(1, Math.max(0, input.confidence ?? 0.6)),
      status: "pending",
      sensitive: input.sensitive === true,
      source: { ...manualSource(), ...(input.source ?? {}), timestamp: input.source?.timestamp ?? t },
      createdAt: t,
      updatedAt: t,
      lastConfirmedAt: t,
    };
    all.push(mem);
    this.write(all);
    return mem;
  }

  async approve(id: string): Promise<Memory> {
    const all = this.read();
    const idx = all.findIndex((m) => m.id === id);
    if (idx < 0) throw new Error("Memory not found");
    const cur = all[idx] as Memory | undefined;
    if (!cur) throw new Error("Memory not found");
    const t = now();
    const prevIdx = all.findIndex(
      (m) => m.id !== id && m.status === "active" && m.category === cur.category && m.key === cur.key,
    );
    const next: Memory = {
      ...cur,
      status: "active",
      updatedAt: t,
      lastConfirmedAt: t,
      ...(prevIdx >= 0 && all[prevIdx] ? { supersedes: (all[prevIdx] as Memory).id } : {}),
    };
    if (prevIdx >= 0) {
      const prev = all[prevIdx] as Memory;
      all[prevIdx] = { ...prev, status: "archived", updatedAt: t };
    }
    all[idx] = next;
    this.write(all);
    return next;
  }

  async confirm(id: string): Promise<Memory> {
    const all = this.read();
    const idx = all.findIndex((m) => m.id === id);
    if (idx < 0) throw new Error("Memory not found");
    const cur = all[idx] as Memory | undefined;
    if (!cur) throw new Error("Memory not found");
    const t = now();
    const next: Memory = { ...cur, updatedAt: t, lastConfirmedAt: t };
    all[idx] = next;
    this.write(all);
    return next;
  }

  async update(id: string, patch: UpdateMemoryInput): Promise<Memory> {
    const t = now();
    const all = this.read();
    const idx = all.findIndex((m) => m.id === id);
    if (idx < 0) throw new Error("Memory not found");
    const cur = all[idx] as Memory | undefined;
    if (!cur) throw new Error("Memory not found");
    const next: Memory = {
      ...cur,
      category: patch.category ?? cur.category,
      key: patch.key !== undefined ? normalizeKey(patch.key) || cur.key : cur.key,
      value: patch.value !== undefined ? patch.value : cur.value,
      sensitive: patch.sensitive ?? cur.sensitive,
      updatedAt: t,
      lastConfirmedAt: t,
    };
    all[idx] = next;
    this.write(all);
    return next;
  }

  async setStatus(id: string, status: MemoryStatus): Promise<Memory> {
    const all = this.read();
    const idx = all.findIndex((m) => m.id === id);
    if (idx < 0) throw new Error("Memory not found");
    const cur = all[idx] as Memory | undefined;
    if (!cur) throw new Error("Memory not found");
    const t = now();
    const next: Memory = {
      ...cur,
      status,
      updatedAt: t,
      lastConfirmedAt: status === "active" ? t : cur.lastConfirmedAt,
    };
    all[idx] = next;
    this.write(all);
    return next;
  }

  async remove(id: string): Promise<void> {
    this.write(this.read().filter((m) => m.id !== id));
  }

  async clear(): Promise<void> {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(this.key);
      } catch {
        // ignore
      }
    }
  }
}

export const localMemoryStore = new LocalStorageMemoryStore();
