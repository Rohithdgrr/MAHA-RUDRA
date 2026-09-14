/** Verification cache (Phase 2, Layer 7.3): verdicts keyed by test+dependency hashes.
 *
 *  `test result keyed by hash(test_file + dependencies). Unchanged deps +
 *  unchanged test = cached verdict` — iterative `test_impact` runs skip
 *  re-execution entirely. Forward transitive closure comes from the shared
 *  import graph; hashes are content-based, so edits (not mtimes) invalidate.
 */
import { buildImportGraph, type FileEntry, type ImportGraph } from "./import-graph";
import { shortHash } from "./content-cache";

export interface VerifyEntry {
  testFile: string;
  passed: boolean;
  summary: string;
  at: number;
}

/** Content hashes for every entry. Pure. */
export function fileHashes(entries: FileEntry[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of entries) out.set(e.path.replace(/\\/g, "/"), shortHash(e.content));
  return out;
}

/** Forward transitive imports of root (the files a test depends on). Pure. */
export function transitiveDeps(graph: ImportGraph, root: string, maxDepth = 10): Set<string> {
  const start = root.replace(/\\/g, "/");
  const seen = new Set<string>([start]);
  let frontier = [start];
  for (let d = 0; d < maxDepth && frontier.length > 0; d++) {
    const next: string[] = [];
    for (const f of frontier) {
      for (const dep of graph.edges.get(f) ?? []) {
        if (!seen.has(dep)) {
          seen.add(dep);
          next.push(dep);
        }
      }
    }
    frontier = next;
  }
  return seen;
}

const MAX_ENTRIES = 200;

interface Stored {
  entry: VerifyEntry;
  hashes: Record<string, string>;
}

export class VerificationCache {
  private stored = new Map<string, Stored>();

  private closure(testFile: string, entries: FileEntry[]): { graph: ImportGraph; hashes: Map<string, string>; closure: Set<string> } {
    const graph = buildImportGraph(entries);
    const hashes = fileHashes(entries);
    return { graph, hashes, closure: transitiveDeps(graph, testFile) };
  }

  private snapshot(closure: Set<string>, hashes: Map<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const f of closure) out[f] = hashes.get(f) ?? "missing";
    return out;
  }

  /** Hit iff the test file and its whole dependency closure are hash-identical. */
  check(testFile: string, entries: FileEntry[]): VerifyEntry | undefined {
    const key = testFile.replace(/\\/g, "/");
    const s = this.stored.get(key);
    if (!s) return undefined;
    const { hashes, closure } = this.closure(testFile, entries);
    const now = this.snapshot(closure, hashes);
    const keys = new Set([...Object.keys(now), ...Object.keys(s.hashes)]);
    for (const k of keys) {
      if (now[k] !== s.hashes[k]) return undefined;
    }
    return s.entry;
  }

  record(testFile: string, entries: FileEntry[], passed: boolean, summary: string): void {
    const key = testFile.replace(/\\/g, "/");
    const { hashes, closure } = this.closure(testFile, entries);
    this.stored.set(key, {
      entry: { testFile: key, passed, summary: summary.slice(0, 500), at: Date.now() },
      hashes: this.snapshot(closure, hashes),
    });
    if (this.stored.size > MAX_ENTRIES) {
      const first = this.stored.keys().next().value;
      if (first) this.stored.delete(first);
    }
  }

  /** Drop entries whose closure touches any changed file. Returns dropped tests. */
  invalidate(changed: string[]): string[] {
    const norm = new Set(changed.map((c) => c.replace(/\\/g, "/")));
    const dropped: string[] = [];
    for (const [test, s] of this.stored) {
      for (const f of Object.keys(s.hashes)) {
        if (norm.has(f)) {
          this.stored.delete(test);
          dropped.push(test);
          break;
        }
      }
    }
    return dropped.sort();
  }

  clear(): void {
    this.stored.clear();
  }

  size(): number {
    return this.stored.size;
  }
}
