/** Two-tier tool schemas (Layers 1.1–1.2): full schema only for recently used
 *  tools, one-line blurbs for the rest. Keeps per-turn schema tax ~2k instead
 *  of ~6k tokens. Pure. */
import { gateTools, inferCapabilities, type ToolName } from "./capability-gates";

export interface ToolSchema {
  name: ToolName;
  blurb: string;
  params: string[];
  example: string;
}

export interface TerseSchema {
  name: ToolName;
  blurb: string;
}

export const TOOL_CATALOG: Record<ToolName, Omit<ToolSchema, "name">> = {
  repo_map: {
    blurb: "Ranked structural map: files → symbols → imports. Call FIRST.",
    params: ["path?", "maxTokens?", "focus?"],
    example: `repo_map({ focus: ["src/api/**"] })`,
  },
  search_symbols: {
    blurb: "Exact symbol definition/references/hover via LSP, regex fallback.",
    params: ["query", "kind", "file?", "line?", "character?"],
    example: `search_symbols({ query: "getUser", kind: "references" })`,
  },
  batch_edit: {
    blurb: "Atomic multi-file edits (create/replace/patch/delete). All-or-nothing.",
    params: ["edits[]", "atomic?"],
    example: `batch_edit({ edits: [{ file: "a.ts", op: "replace", content: "…" }] })`,
  },
  checkpoint: {
    blurb: "Snapshot files before risky edits. Never touches real git history.",
    params: ["label", "files?"],
    example: `checkpoint({ label: "before refactor" })`,
  },
  restore: {
    blurb: "Roll back to a checkpoint id or label.",
    params: ["label_or_id"],
    example: `restore("before refactor")`,
  },
  run_verify: {
    blurb: "Run a command with declared success criteria. Returns a verdict.",
    params: ["cmd", "cwd?", "timeout_ms?", "expect?", "stream?"],
    example: `run_verify({ cmd: "npm run test", expect: { exit_code: 0 } })`,
  },
  test_impact: {
    blurb: "Plan: tests whose transitive imports touch changed files.",
    params: ["changed?", "depth?"],
    example: `test_impact({ changed: ["src/foo.ts"] })`,
  },
  lint_typecheck: {
    blurb: "Fast structured diagnostics (tsc/eslint/ruff/cargo) before tests.",
    params: ["paths?", "fix?", "severity?"],
    example: `lint_typecheck({ paths: ["src/a.ts"], fix: true })`,
  },
  scratchpad: {
    blurb: "Session working memory: plan, decisions, failed_attempts.",
    params: ["op", "key?", "value?"],
    example: `scratchpad({ op: "read", key: "plan" })`,
  },
  fetch_docs: {
    blurb: "Cached docs lookup, filtered to the query. Repeat hits are free.",
    params: ["url", "query?", "max_tokens?"],
    example: `fetch_docs({ url: "https://…", query: "useEffect cleanup" })`,
  },
  parallel_subagents: {
    blurb: "Fan out independent READ-ONLY tasks. Never edits.",
    params: ["tasks[]", "max_concurrency?", "merge?"],
    example: `parallel_subagents({ tasks: [{ id: "a", goal: "find auth" }] })`,
  },
  adversarial_review: {
    blurb: "Fresh-context critique of a diff. Runs concurrent with tests.",
    params: ["diff?", "checklist?", "max_findings?"],
    example: `adversarial_review({ checklist: ["security"] })`,
  },
  git_history: {
    blurb: "Blame/log/diff/pr context. Why is this code like this?",
    params: ["op", "file?", "line_start?", "line_end?", "pr?"],
    example: `git_history({ op: "blame", file: "src/a.ts", line_start: 40, line_end: 60 })`,
  },
  db_schema: {
    blurb: "Database shape: columns/indexes/FKs/row counts. Name, never DSN.",
    params: ["connection", "tables?", "include?"],
    example: `db_schema({ connection: "app" })`,
  },
  db_query: {
    blurb: "Safe queries: read_only default, explain plans, auto-rollback.",
    params: ["connection", "sql", "mode?", "max_rows?"],
    example: `db_query({ connection: "app", sql: "SELECT 1", mode: "read_only" })`,
  },
  http_call: {
    blurb: "Structured HTTP with expect verdict. Secrets by name, redacted.",
    params: ["method", "url", "headers?", "body?", "auth?", "expect?"],
    example: `http_call({ method: "GET", url: "https://…/health", expect: { status: 200 } })`,
  },
  dep_graph: {
    blurb: "Dependency audit/why/upgrade-impact across npm/cargo/pip/go.",
    params: ["op", "package?", "ecosystem?"],
    example: `dep_graph({ op: "audit" })`,
  },
  env_audit: {
    blurb: "Preflight: will tests even run? Missing env before 3-min failures.",
    params: ["source?", "required?", "check_connectivity?"],
    example: `env_audit({})`,
  },
  api_schema: {
    blurb: "Contract shapes: OpenAPI/GraphQL/proto/Tauri commands.",
    params: ["source", "spec?", "operation?", "service?"],
    example: `api_schema({ source: "file", operation: "GET /users" })`,
  },
  visual_verify: {
    blurb: "Frontend only: screenshot + DOM/console verdict for UI diffs.",
    params: ["url", "viewport?", "actions?", "baseline?", "expect_selector?"],
    example: `visual_verify({ url: "http://localhost:5173/", expect_selector: "#app" })`,
  },
};

export interface TieredSchemas {
  full: ToolSchema[];
  terse: TerseSchema[];
}

/** Full schemas for recently used tools (default: last 3), blurbs for the rest. */
export function twoTierSchemas(gated: ToolName[], recentTools: string[], recentKept = 3): TieredSchemas {
  const recent = recentTools.filter((t): t is ToolName => t in TOOL_CATALOG).slice(-Math.max(1, recentKept));
  const recentSet = new Set<string>(recent);
  const full: ToolSchema[] = [];
  const terse: TerseSchema[] = [];
  for (const name of gated) {
    const entry = TOOL_CATALOG[name];
    if (!entry) continue;
    if (recentSet.has(name)) full.push({ name, ...entry });
    else terse.push({ name, blurb: entry.blurb });
  }
  return { full, terse };
}

export interface SessionTools {
  gated: ToolName[];
  tiers: TieredSchemas;
}

/** Session-start wiring: detect workspace → gate → tier. One call. Pure. */
export function resolveSessionTools(fileList: string[], recentTools: string[] = []): SessionTools {
  const gated = gateTools(inferCapabilities(fileList));
  return { gated, tiers: twoTierSchemas(gated, recentTools) };
}
