/** Content + call-arg cache: kill silent re-read waste (Layers 6.1, 2.4, 7.4).
 *
 *  - `ContentCache.check()` turns a re-read of unchanged content into a
 *    ~15-token marker: `src/api.ts (unchanged since turn 4, hash a3f9)`.
 *  - `ToolCallCache` answers "did I already call this with the same args?"
 *    so duplicate tool calls return the cached result with a note.
 *  Both are session-scoped and bounded. Pure logic; the caller supplies text.
 */
import { hashString } from "./types";

export function shortHash(content: string): string {
  return hashString(content);
}

/** `path (unchanged since turn N, hash h)`. Pure. */
export function formatUnchanged(path: string, hash: string, sinceTurn: number): string {
  return `${path} (unchanged since turn ${sinceTurn}, hash ${hash.slice(0, 8)})`;
}

export type ReadOutcome =
  | { status: "fresh"; content: string; hash: string }
  | { status: "unchanged"; marker: string; hash: string };

interface SeenFile {
  hash: string;
  firstTurn: number;
  lastTurn: number;
}

const MAX_FILES = 500;

/** Content-addressed file store. The caller reads disk; this decides fresh vs marker. */
export class ContentCache {
  private seen = new Map<string, SeenFile>();

  /** Check current content against what was seen. Pure wrt disk. */
  check(path: string, content: string, turn: number): ReadOutcome {
    const key = path.replace(/\\/g, "/");
    const hash = shortHash(content);
    const prev = this.seen.get(key);
    if (prev && prev.hash === hash) {
      prev.lastTurn = turn;
      return { status: "unchanged", marker: formatUnchanged(key, hash, prev.firstTurn), hash };
    }
    this.seen.set(key, { hash, firstTurn: turn, lastTurn: turn });
    if (this.seen.size > MAX_FILES) {
      const oldest = [...this.seen.entries()].sort((a, b) => a[1].lastTurn - b[1].lastTurn)[0];
      if (oldest) this.seen.delete(oldest[0]);
    }
    return { status: "fresh", content, hash };
  }

  /** Forget paths (e.g. after batch_edit touches them). */
  invalidate(paths: string[]): void {
    for (const p of paths) this.seen.delete(p.replace(/\\/g, "/"));
  }

  clear(): void {
    this.seen.clear();
  }

  size(): number {
    return this.seen.size;
  }
}

const MAX_CALLS = 100;

interface CachedCall {
  output: string;
  turn: number;
}

/** Session-scoped exact-arg dedup for idempotent tools (reads, audits, docs). */
export class ToolCallCache {
  private calls = new Map<string, CachedCall>();

  static key(tool: string, args: unknown): string {
    let serialized: string;
    try {
      serialized = JSON.stringify(args ?? null);
    } catch {
      serialized = String(args);
    }
    return `${tool.trim() || "unknown"}:${hashString(serialized)}`;
  }

  get(tool: string, args: unknown): { output: string; turn: number } | undefined {
    return this.calls.get(ToolCallCache.key(tool, args));
  }

  set(tool: string, args: unknown, output: string, turn: number): void {
    this.calls.set(ToolCallCache.key(tool, args), { output: output.slice(0, 20_000), turn });
    if (this.calls.size > MAX_CALLS) {
      const first = this.calls.keys().next().value;
      if (first) this.calls.delete(first);
    }
  }

  /** Note appended when serving a cached result. Pure. */
  static hitNote(turn: number): string {
    return `[cached result from turn ${turn} — args identical, not re-executed]`;
  }

  clear(): void {
    this.calls.clear();
  }
}
