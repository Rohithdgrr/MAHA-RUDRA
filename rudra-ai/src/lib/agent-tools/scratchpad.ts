/** scratchpad: persistent working memory across turns. In-memory + pluggable storage. */
import { ToolError } from "./types";

export type ScratchOp = "read" | "write" | "append" | "clear";

export interface ScratchInput {
  op: ScratchOp;
  key?: string;
  value?: string;
}

export interface ScratchResult {
  key?: string;
  value?: string;
  keys?: string[];
}

export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(prefix: string): string[];
  clearPrefix(prefix: string): void;
}

export const CONVENTIONAL_KEYS = ["plan", "touched_files", "decisions", "failed_attempts", "open_questions"] as const;
const MAX_VALUE_CHARS = 100_000;
const NS = "scratchpad:";

function checkKey(key: string | undefined, requireKey: boolean): string {
  if (!key || !key.trim()) {
    if (requireKey) throw new ToolError("BAD_INPUT", "key is required for this op");
    return "";
  }
  const k = key.trim();
  if (k.length > 120) throw new ToolError("BAD_INPUT", "key too long (max 120)");
  if (!/^[A-Za-z0-9_.-]+$/.test(k)) throw new ToolError("BAD_INPUT", `invalid key: ${k}`);
  return k;
}

export class MemoryKV implements KeyValueStorage {
  private m = new Map<string, string>();
  get(key: string): string | null {
    return this.m.has(key) ? (this.m.get(key) as string) : null;
  }
  set(key: string, value: string): void {
    this.m.set(key, value);
  }
  remove(key: string): void {
    this.m.delete(key);
  }
  keys(prefix: string): string[] {
    return [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
  }
  clearPrefix(prefix: string): void {
    for (const k of [...this.m.keys()]) if (k.startsWith(prefix)) this.m.delete(k);
  }
}

/** localStorage adapter with private-mode fallback to memory. */
export function localStorageKV(): KeyValueStorage {
  const mem = new MemoryKV();
  try {
    if (typeof window === "undefined" || !window.localStorage) return mem;
    return {
      get: (k) => {
        try {
          return window.localStorage.getItem(k);
        } catch {
          return mem.get(k);
        }
      },
      set: (k, v) => {
        try {
          window.localStorage.setItem(k, v);
        } catch {
          mem.set(k, v);
        }
      },
      remove: (k) => {
        try {
          window.localStorage.removeItem(k);
        } catch {
          mem.remove(k);
        }
      },
      keys: (prefix) => {
        try {
          const out: string[] = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k && k.startsWith(prefix)) out.push(k.slice(prefix.length));
          }
          return out.length ? out : mem.keys(prefix);
        } catch {
          return mem.keys(prefix);
        }
      },
      clearPrefix: (prefix) => {
        try {
          const drop: string[] = [];
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k && k.startsWith(prefix)) drop.push(k);
          }
          for (const k of drop) window.localStorage.removeItem(k);
        } catch {
          mem.clearPrefix(prefix);
        }
      },
    };
  } catch {
    return mem;
  }
}

export function scratchpad(store: KeyValueStorage, input: ScratchInput): ScratchResult {
  switch (input.op) {
    case "read": {
      if (input.key) {
        const k = checkKey(input.key, true);
        return { key: k, value: store.get(NS + k) ?? undefined };
      }
      const keys = store.keys(NS);
      return { keys };
    }
    case "write": {
      const k = checkKey(input.key, true);
      if (input.value === undefined) throw new ToolError("BAD_INPUT", "value is required for write");
      if (input.value.length > MAX_VALUE_CHARS)
        throw new ToolError("BAD_INPUT", `value too large (max ${MAX_VALUE_CHARS} chars)`);
      store.set(NS + k, input.value);
      return { key: k, value: input.value.slice(0, 2000) };
    }
    case "append": {
      const k = checkKey(input.key, true);
      if (input.value === undefined) throw new ToolError("BAD_INPUT", "value is required for append");
      const prev = store.get(NS + k) ?? "";
      const next = prev ? `${prev}\n${input.value}` : input.value;
      if (next.length > MAX_VALUE_CHARS)
        throw new ToolError("BAD_INPUT", "append would exceed max size; clear or rewrite instead");
      store.set(NS + k, next);
      return { key: k, value: next.slice(-2000) };
    }
    case "clear": {
      if (input.key) {
        const k = checkKey(input.key, true);
        store.remove(NS + k);
        return { key: k };
      }
      store.clearPrefix(NS);
      return { keys: [] };
    }
  }
}
