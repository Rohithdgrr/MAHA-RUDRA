/** Session precompute (Phase 2, Layer 10.2): pay once, reuse every turn.
 *
 *  At session start, build and freeze: the repo map, the import graph file
 *  list, and the referenced env vars. Later turns reuse the bundle instead of
 *  re-scanning; `isFresh()` compares a content digest to detect drift.
 *  Pure — the caller supplies file entries.
 */
import { scanEnvRefs } from "../agent-tools/env-audit";
import { buildImportGraph, type FileEntry } from "../agent-tools/import-graph";
import { repoMap } from "../agent-tools/repo-map";
import { hashString } from "../agent-tools/types";

export interface PrecomputeInput {
  focus?: string[];
  mapTokens?: number;
}

export interface SessionPrecompute {
  at: number;
  /** Content digest of the scanned entries. */
  fileDigest: string;
  fileCount: number;
  repoMapMarkdown: string;
  repoMapTruncated: boolean;
  graphFiles: string[];
  envRefs: string[];
}

/** Stable digest over sorted path+content hashes. Pure. */
export function digestEntries(entries: FileEntry[]): string {
  const parts = entries
    .map((e) => `${e.path.replace(/\\/g, "/")}:${hashString(e.content)}`)
    .sort()
    .join("\n");
  return hashString(parts);
}

export function precomputeSession(entries: FileEntry[], input: PrecomputeInput = {}): SessionPrecompute {
  const map = repoMap(entries, { maxTokens: input.mapTokens ?? 2000, focus: input.focus });
  const graph = buildImportGraph(entries);
  const envRefs = scanEnvRefs(entries.map((e) => ({ path: e.path, content: e.content })));
  return {
    at: Date.now(),
    fileDigest: digestEntries(entries),
    fileCount: entries.length,
    repoMapMarkdown: map.markdown,
    repoMapTruncated: map.truncated,
    graphFiles: [...graph.files].sort(),
    envRefs,
  };
}

/** True when the bundle still describes these entries (no drift). Pure. */
export function isFresh(bundle: SessionPrecompute, entries: FileEntry[]): boolean {
  return bundle.fileDigest === digestEntries(entries);
}
