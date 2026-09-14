import { logger } from "../utils/logger";
import type { Memory, MemoryStatus } from "./types";
import { createMemoryId } from "./types";
import type { MemoryStore, NewMemoryInput, UpdateMemoryInput } from "./store";
import { normalizeKey } from "./store";
import { MEMORY_STORAGE_KEY, parseMemories, sanitizeRecord } from "./store.local";

const DB_NAME = "rudra-memory";
const DB_VERSION = 1;
const STORE = "memories";
const OPEN_TIMEOUT_MS = 3000;

function idb(): IDBFactory | undefined {
  return typeof indexedDB !== "undefined" ? indexedDB : undefined;
}

export function indexedDBAvailable(): boolean {
  return idb() !== undefined;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const factory = idb();
    if (!factory) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("IndexedDB open timed out"));
      }
    }, OPEN_TIMEOUT_MS);
    try {
      const req = factory.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => {
        if (settled) {
          req.result.close();
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(req.result);
      };
      req.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(req.error ?? new Error("IndexedDB open failed"));
      };
    } catch (err) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err as Error);
      }
    }
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

async function readAll(db: IDBDatabase): Promise<Memory[]> {
  const tx = db.transaction(STORE, "readonly");
  const out = await request(tx.objectStore(STORE).getAll());
  const list = Array.isArray(out) ? out : [];
  const valid: Memory[] = [];
  for (const item of list) {
    const m = sanitizeRecord(item);
    if (m) valid.push(m);
  }
  return valid;
}

async function writeAll(db: IDBDatabase, all: Memory[]): Promise<void> {
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  await request(store.clear());
  for (const m of all) store.put(m);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB write aborted"));
  });
}

/** IndexedDB impl (web + Tauri webview). Same semantics as the localStorage impl. */
export class IndexedDBMemoryStore implements MemoryStore {
  async list(): Promise<Memory[]> {
    const db = await openDb();
    try {
      return (await readAll(db)).sort((a, b) => b.updatedAt - a.updatedAt);
    } finally {
      db.close();
    }
  }

  async get(id: string): Promise<Memory | undefined> {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readonly");
      const raw = await request(tx.objectStore(STORE).get(id));
      return sanitizeRecord(raw);
    } finally {
      db.close();
    }
  }

  async upsert(input: NewMemoryInput): Promise<Memory> {
    const key = normalizeKey(input.key);
    if (!key) throw new Error("Memory key is required");
    const db = await openDb();
    try {
      const t = Date.now();
      const all = await readAll(db);
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
        source: {
          sessionId: input.source?.sessionId ?? "manual",
          messageId: input.source?.messageId ?? "manual",
          excerpt: input.source?.excerpt ?? "",
          timestamp: input.source?.timestamp ?? t,
        },
        createdAt: t,
        updatedAt: t,
        lastConfirmedAt: t,
        ...(prev ? { supersedes: prev.id } : {}),
      };
      const next = all.map((m) =>
        prev && m.id === prev.id ? { ...m, status: "archived" as MemoryStatus, updatedAt: t } : m,
      );
      next.push(mem);
      await writeAll(db, next);
      return mem;
    } finally {
      db.close();
    }
  }

  async propose(input: NewMemoryInput): Promise<Memory> {
    const key = normalizeKey(input.key);
    if (!key) throw new Error("Memory key is required");
    const db = await openDb();
    try {
      const t = Date.now();
      const all = await readAll(db);
      const mem: Memory = {
        id: createMemoryId(),
        category: input.category,
        key,
        value: input.value,
        confidence: Math.min(1, Math.max(0, input.confidence ?? 0.6)),
        status: "pending",
        sensitive: input.sensitive === true,
        source: {
          sessionId: input.source?.sessionId ?? "manual",
          messageId: input.source?.messageId ?? "manual",
          excerpt: input.source?.excerpt ?? "",
          timestamp: input.source?.timestamp ?? t,
        },
        createdAt: t,
        updatedAt: t,
        lastConfirmedAt: t,
      };
      all.push(mem);
      await writeAll(db, all);
      return mem;
    } finally {
      db.close();
    }
  }

  async approve(id: string): Promise<Memory> {
    return this.mutate(id, (cur, all, t) => {
      const prevIdx = all.findIndex(
        (m) => m.id !== id && m.status === "active" && m.category === cur.category && m.key === cur.key,
      );
      if (prevIdx >= 0) {
        const prev = all[prevIdx] as Memory;
        all[prevIdx] = { ...prev, status: "archived", updatedAt: t };
      }
      return {
        ...cur,
        status: "active",
        updatedAt: t,
        lastConfirmedAt: t,
        ...(prevIdx >= 0 && all[prevIdx] ? { supersedes: (all[prevIdx] as Memory).id } : {}),
      };
    });
  }

  async confirm(id: string): Promise<Memory> {
    return this.mutate(id, (cur, _all, t) => ({ ...cur, updatedAt: t, lastConfirmedAt: t }));
  }

  async update(id: string, patch: UpdateMemoryInput): Promise<Memory> {
    return this.mutate(id, (cur, _all, t) => ({
      ...cur,
      category: patch.category ?? cur.category,
      key: patch.key !== undefined ? normalizeKey(patch.key) || cur.key : cur.key,
      value: patch.value !== undefined ? patch.value : cur.value,
      sensitive: patch.sensitive ?? cur.sensitive,
      updatedAt: t,
      lastConfirmedAt: t,
    }));
  }

  async setStatus(id: string, status: MemoryStatus): Promise<Memory> {
    return this.mutate(id, (cur, _all, t) => ({
      ...cur,
      status,
      updatedAt: t,
      lastConfirmedAt: status === "active" ? t : cur.lastConfirmedAt,
    }));
  }

  private async mutate(
    id: string,
    fn: (cur: Memory, all: Memory[], t: number) => Memory,
  ): Promise<Memory> {
    const db = await openDb();
    try {
      const t = Date.now();
      const all = await readAll(db);
      const idx = all.findIndex((m) => m.id === id);
      if (idx < 0) throw new Error("Memory not found");
      const cur = all[idx] as Memory | undefined;
      if (!cur) throw new Error("Memory not found");
      const next = fn(cur, all, t);
      all[idx] = next;
      await writeAll(db, all);
      return next;
    } finally {
      db.close();
    }
  }

  async remove(id: string): Promise<void> {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readwrite");
      await request(tx.objectStore(STORE).delete(id));
    } finally {
      db.close();
    }
  }

  async clear(): Promise<void> {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readwrite");
      await request(tx.objectStore(STORE).clear());
    } finally {
      db.close();
    }
  }
}

/**
 * Pick the best store: IndexedDB when available (migrating any existing
 * localStorage rows once), else localStorage. Never throws.
 */
export async function resolveMemoryStore(): Promise<MemoryStore> {
  const { localMemoryStore } = await import("./store.local");
  if (!indexedDBAvailable()) return localMemoryStore;
  try {
    const idbStore = new IndexedDBMemoryStore();
    const existing = await idbStore.list();
    if (existing.length === 0 && typeof window !== "undefined") {
      const legacy = parseMemories(window.localStorage.getItem(MEMORY_STORAGE_KEY));
      if (legacy.length > 0) {
        const db = await openDb();
        try {
          await writeAll(db, legacy);
        } finally {
          db.close();
        }
        logger.info(`Migrated ${legacy.length} memories to IndexedDB`);
      }
    }
    return idbStore;
  } catch (err) {
    logger.warn(`IndexedDB unavailable, using localStorage: ${(err as Error).message}`);
    return localMemoryStore;
  }
}
