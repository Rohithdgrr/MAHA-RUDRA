/** repo_map: compressed structural map ranked by PageRank over import graph. Pure. */
import {
  buildImportGraph,
  extractSymbols,
  globMatch,
  pageRank,
  type FileEntry,
} from "./import-graph";
import { ToolError, estimateTokens, truncateToTokens } from "./types";

export interface RepoMapInput {
  path?: string;
  maxTokens?: number;
  focus?: string[];
}

export interface RepoMapResult {
  markdown: string;
  filesRanked: string[];
  truncated: boolean;
  tokensEstimate: number;
}

const SKIP_DIRS = ["node_modules/", "dist/", "target/", ".git/", "gen/"];

function shouldSkip(path: string): boolean {
  const p = path.replace(/\\/g, "/");
  return SKIP_DIRS.some((d) => p.includes(d));
}

export function repoMap(entries: FileEntry[], input: RepoMapInput = {}): RepoMapResult {
  const maxTokens = input.maxTokens ?? 2000;
  if (!Number.isFinite(maxTokens) || maxTokens <= 0) {
    throw new ToolError("BAD_INPUT", "maxTokens must be a positive number");
  }
  const prefix = (input.path ?? ".").replace(/\\/g, "/").replace(/^\.\//, "");
  const scoped =
    prefix === "." || prefix === ""
      ? entries
      : entries.filter((e) => e.path.replace(/\\/g, "/").startsWith(prefix.replace(/\/$/, "") + "/"));
  const usable = scoped.filter((e) => !shouldSkip(e.path));
  if (usable.length === 0) {
    return { markdown: "# repo map\n\n_(empty)_", filesRanked: [], truncated: false, tokensEstimate: 4 };
  }
  const graph = buildImportGraph(usable);
  const scores = pageRank(graph);
  // focus boost: files matching focus globs get 2x weight
  const focus = input.focus ?? [];
  const boosted = new Map<string, number>();
  for (const f of graph.files) {
    let s = scores.get(f) ?? 0;
    if (focus.some((g) => globMatch(g, f))) s *= 2;
    // tiny tiebreak by symbol count so empty files sink
    const entry = usable.find((e) => e.path.replace(/\\/g, "/").endsWith(f) || e.path === f);
    void entry;
    boosted.set(f, s);
  }
  const ranked = [...graph.files].sort((a, b) => (boosted.get(b) ?? 0) - (boosted.get(a) ?? 0));
  const byPath = new Map(usable.map((e) => [e.path.replace(/\\/g, "/"), e]));
  // fallback: if graph degenerate (all equal), larger symbol count first
  const allEqual = new Set(boosted.values()).size <= 1;
  if (allEqual) {
    ranked.sort((a, b) => {
      const sa = extractSymbols(a, byPath.get(a)?.content ?? "").length;
      const sb = extractSymbols(b, byPath.get(b)?.content ?? "").length;
      return sb - sa;
    });
  }
  let md = "# repo map\n\n";
  for (const f of ranked) {
    const entry = byPath.get(f) ?? usable.find((e) => e.path === f);
    const content = entry?.content ?? "";
    const syms = extractSymbols(f, content);
    const imports = graph.edges.get(f) ?? [];
    md += `## ${f}\n`;
    if (syms.length === 0) md += `- _(no exported symbols)_\n`;
    for (const s of syms.slice(0, 12)) {
      md += `- ${s.kind} \`${s.name}\` (L${s.line})${s.signature ? ` — ${s.signature}` : ""}\n`;
    }
    if (imports.length > 0) md += `- imports: ${imports.slice(0, 8).join(", ")}\n`;
    md += "\n";
    if (estimateTokens(md) > maxTokens) break;
  }
  const tokensEstimate = estimateTokens(md);
  const truncated = tokensEstimate >= maxTokens;
  const markdown = truncated ? truncateToTokens(md, maxTokens) : md;
  return {
    markdown,
    filesRanked: ranked,
    truncated,
    tokensEstimate: estimateTokens(markdown),
  };
}
