/** Capability gates (Option A): expose only relevant tools per workspace. Pure. */

export type Ecosystem = "npm" | "cargo" | "pip" | "go" | "maven";

export interface WorkspaceCapabilities {
  hasGit: boolean;
  hasDb: boolean;
  hasServices: boolean;
  isFrontend: boolean;
  isBackend: boolean;
  hasLsp: boolean;
  allowBrowser: boolean;
  ecosystems: Ecosystem[];
}

export const ALL_TOOLS = [
  "repo_map",
  "search_symbols",
  "batch_edit",
  "checkpoint",
  "restore",
  "run_verify",
  "test_impact",
  "lint_typecheck",
  "scratchpad",
  "fetch_docs",
  "parallel_subagents",
  "adversarial_review",
  "git_history",
  "db_schema",
  "db_query",
  "http_call",
  "dep_graph",
  "env_audit",
  "api_schema",
  "visual_verify",
] as const;

export type ToolName = (typeof ALL_TOOLS)[number];

/** Heuristic inference from repo file list. Pure, never throws. */
export function inferCapabilities(files: string[]): WorkspaceCapabilities {
  const has = (sub: string) => files.some((f) => f.replace(/\\/g, "/").includes(sub));
  const hasGit = files.some((f) => /(^|\/)\.git(\/|$)/.test(f.replace(/\\/g, "/"))) || has(".git");
  const hasDb =
    has("prisma/schema") ||
    has("drizzle/") ||
    has("migrations/") ||
    files.some((f) => /sqlx|diesel|sea-orm|typeorm|prisma/i.test(f));
  const hasServices =
    has("openapi.") || has("proto/") || has(".proto") || has("docker-compose") || has("services/");
  const isFrontend =
    has("src/components/") ||
    has("src/pages/") ||
    files.some((f) => /\.(tsx|jsx|vue)$/.test(f));
  const isBackend =
    has("src-tauri/") || has("server/") || has("api/") || files.some((f) => /\.(rs|go|py)$/.test(f));
  const ecosystems: Ecosystem[] = [];
  if (files.some((f) => f.endsWith("package.json"))) ecosystems.push("npm");
  if (files.some((f) => f.endsWith("Cargo.toml"))) ecosystems.push("cargo");
  if (files.some((f) => f.endsWith("requirements.txt") || f.endsWith("pyproject.toml")))
    ecosystems.push("pip");
  if (files.some((f) => f.endsWith("go.mod"))) ecosystems.push("go");
  const hasLsp = ecosystems.length > 0;
  return {
    hasGit,
    hasDb,
    hasServices,
    isFrontend,
    isBackend,
    hasLsp,
    allowBrowser: isFrontend,
    ecosystems,
  };
}

/** Effective tool subset for a session. Keeps count ~9-12. Pure. */
export function gateTools(caps: WorkspaceCapabilities): ToolName[] {
  const out: ToolName[] = [
    "repo_map",
    "batch_edit",
    "checkpoint",
    "restore",
    "run_verify",
    "test_impact",
    "lint_typecheck",
    "scratchpad",
  ];
  if (caps.hasLsp) out.push("search_symbols");
  if (caps.hasGit) out.push("git_history");
  if (caps.ecosystems.length > 0) out.push("dep_graph");
  out.push("env_audit"); // cheap preflight, always useful
  out.push("parallel_subagents", "adversarial_review");
  if (caps.hasDb) out.push("db_schema", "db_query");
  if (caps.isBackend || caps.hasServices) out.push("http_call", "api_schema", "fetch_docs");
  else if (caps.isFrontend) out.push("fetch_docs");
  if (caps.allowBrowser && caps.isFrontend) out.push("visual_verify");
  // dedupe, preserve order
  return [...new Set(out)];
}
