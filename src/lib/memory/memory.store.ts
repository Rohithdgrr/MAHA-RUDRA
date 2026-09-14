import { createStore } from "solid-js/store";
import { logger } from "../utils/logger";
import type { Memory, MemoryStatus } from "./types";
import type { MemoryStore, NewMemoryInput, UpdateMemoryInput } from "./store";
import { localMemoryStore } from "./store.local";
import { clearAudit, logAudit } from "./audit";
import { isSensitive, redactCheck } from "./redact";

interface MemoryState {
  memories: Memory[];
  loaded: boolean;
  error: string | undefined;
}

const [state, setState] = createStore<MemoryState>({ memories: [], loaded: false, error: undefined });

let impl: MemoryStore = localMemoryStore;
let resolved = false;
let overridden = false;

/** Swap persistence impl (tests + future SQLite). Disables auto-resolve. */
export function setMemoryStore(next: MemoryStore): void {
  impl = next;
  overridden = true;
}

/** First load upgrades localStorage → IndexedDB when available (one-time migration). */
async function ensureImpl(): Promise<void> {
  if (resolved || overridden) return;
  resolved = true;
  try {
    const { resolveMemoryStore } = await import("./store.idb");
    impl = await resolveMemoryStore();
  } catch {
    impl = localMemoryStore;
  }
}

async function refresh(): Promise<void> {
  try {
    await ensureImpl();
    const memories = await impl.list();
    setState({ memories, loaded: true, error: undefined });
  } catch (err) {
    logger.warn(`Memory load failed: ${(err as Error).message}`);
    setState("error", (err as Error).message);
    setState("loaded", true);
  }
}

export const memoryStore = {
  get state() {
    return state;
  },
  async load(): Promise<void> {
    await refresh();
  },
  resetForTests(): void {
    setState({ memories: [], loaded: false, error: undefined });
    impl = localMemoryStore;
    resolved = false;
    overridden = false;
    clearAudit();
  },
  active(): Memory[] {
    return state.memories.filter((m) => m.status === "active");
  },
  pending(): Memory[] {
    return state.memories.filter((m) => m.status === "pending");
  },
  byCategory(category: Memory["category"]): Memory[] {
    return state.memories.filter((m) => m.category === category && m.status === "active");
  },
  /** Manual save from Settings. Secrets are rejected before storage. */
  async add(input: NewMemoryInput): Promise<Memory> {
    const blocked = redactCheck(input.value);
    if (blocked.blocked) throw new Error(`Blocked: looks like ${blocked.reason ?? "a secret"}`);
    const mem = await impl.upsert({
      ...input,
      sensitive: input.sensitive ?? isSensitive(input.category, input.key),
      source: { sessionId: "manual", messageId: "manual", excerpt: "Entered manually", ...input.source },
    });
    logAudit("add", { memoryId: mem.id, sessionId: input.source?.sessionId });
    await refresh();
    return mem;
  },
  /** Queue a candidate for review; never auto-activates. Secrets rejected first. */
  async propose(input: NewMemoryInput): Promise<Memory> {
    const blocked = redactCheck(input.value);
    if (blocked.blocked) throw new Error(`Blocked: looks like ${blocked.reason ?? "a secret"}`);
    const mem = await impl.propose({
      ...input,
      sensitive: input.sensitive ?? isSensitive(input.category, input.key),
    });
    logAudit("propose", { memoryId: mem.id, sessionId: input.source?.sessionId });
    await refresh();
    return mem;
  },
  async approve(id: string): Promise<Memory> {
    const mem = await impl.approve(id);
    logAudit("approve", { memoryId: id });
    await refresh();
    return mem;
  },
  async reject(id: string): Promise<Memory> {
    const mem = await impl.setStatus(id, "rejected");
    logAudit("reject", { memoryId: id });
    await refresh();
    return mem;
  },
  async confirm(id: string): Promise<Memory> {
    const mem = await impl.confirm(id);
    logAudit("confirm", { memoryId: id });
    await refresh();
    return mem;
  },
  async update(id: string, patch: UpdateMemoryInput): Promise<Memory> {
    if (patch.value !== undefined) {
      const blocked = redactCheck(patch.value);
      if (blocked.blocked) throw new Error(`Blocked: looks like ${blocked.reason ?? "a secret"}`);
    }
    const mem = await impl.update(id, patch);
    logAudit("update", { memoryId: id });
    await refresh();
    return mem;
  },
  async setStatus(id: string, status: MemoryStatus): Promise<Memory> {
    const mem = await impl.setStatus(id, status);
    logAudit("status", { memoryId: id, detail: status });
    await refresh();
    return mem;
  },
  async remove(id: string): Promise<void> {
    await impl.remove(id);
    logAudit("remove", { memoryId: id });
    await refresh();
  },
  async clearAll(): Promise<void> {
    await impl.clear();
    logAudit("clear");
    clearAudit();
    await refresh();
  },
};
