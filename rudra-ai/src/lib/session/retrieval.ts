/** Retrieval discipline (Phase 3, Layer 9): never grep-then-read.
 *
 *  Enforced order: `repo_map` → `search_symbols` → range read. Read once per
 *  session (content cache), ask before fetching (registry/scratchpad first),
 *  batch independent reads, top-K aggressive (3, not 20). Pure planners — the
 *  loop executes the steps.
 */

import { parseFileRef } from "../history/references";

export interface RetrievalStep {
  tool: "repo_map" | "search_symbols" | "read_range" | "fetch_docs" | "git_history";
  args: Record<string, string | number | string[]>;
  why: string;
}

export interface RetrievalInput {
  goal: string;
  /** Focus globs from the precompute bundle or the task. */
  focus?: string[];
  /** Symbol or keyword hints extracted from the goal. */
  queries?: string[];
  /** Already-known refs (file@hash, doc ids) — skip re-fetching these. */
  knownRefs?: string[];
  topK?: number;
}

/** Aggressive top-K: 3 results default; the model asks for more. */
export const DEFAULT_TOP_K = 3;
export const MAX_TOP_K = 10;

export function clampTopK(topK: number | undefined): number {
  if (!Number.isFinite(topK ?? NaN)) return DEFAULT_TOP_K;
  return Math.min(MAX_TOP_K, Math.max(1, Math.floor(topK as number)));
}

/** Ordered retrieval plan for a goal. Map first, symbols second, reads last. */
export function planRetrieval(input: RetrievalInput): RetrievalStep[] {
  const goal = input.goal.trim().slice(0, 300);
  if (!goal) throw new Error("goal must be non-empty");
  const topK = clampTopK(input.topK);
  const knownPaths = new Set(
    (input.knownRefs ?? []).map((r) => parseFileRef(r)?.path).filter((p): p is string => !!p),
  );
  const steps: RetrievalStep[] = [];
  steps.push({
    tool: "repo_map",
    args: { ...(input.focus && input.focus.length > 0 ? { focus: input.focus.slice(0, 5) } : {}) },
    why: "orient: ranked map before any search",
  });
  const queries = (input.queries ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    // already holding this exact file — searching for it is pure waste
    .filter((q) => !knownPaths.has(q.replace(/\\/g, "/")))
    .slice(0, 5);
  for (const q of queries) {
    steps.push({
      tool: "search_symbols",
      args: { query: q, kind: "references", topK },
      why: `locate: exact references for "${q.slice(0, 60)}"`,
    });
  }
  return steps;
}

/** Ask before fetching: skip when the answer is already referenced or was tried. */
export function shouldFetch(args: {
  url: string;
  knownDocIds: string[];
  failedUrls: string[];
  fetchedUrls: string[];
}): { fetch: boolean; reason: string } {
  const url = args.url.trim();
  if (!url) return { fetch: false, reason: "empty url" };
  if (args.knownDocIds.some((id) => id.includes(url) || url.includes(id.replace(/^doc:/, "").split("-")[0] ?? ""))) {
    return { fetch: false, reason: "already have this doc — use its doc_id" };
  }
  if (args.fetchedUrls.includes(url)) return { fetch: false, reason: "fetched already this session" };
  if (args.failedUrls.includes(url)) return { fetch: false, reason: "fetch failed before — don't retry as-is" };
  return { fetch: true, reason: "not yet retrieved" };
}
