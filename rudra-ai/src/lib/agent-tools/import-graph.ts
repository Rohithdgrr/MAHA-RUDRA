/** Import graph + symbol extraction shared by repo_map / test_impact / dep_graph. Pure. */
import { estimateTokens } from "./types";

export interface FileEntry {
  path: string;
  content: string;
}

export interface SymbolInfo {
  name: string;
  kind: "function" | "class" | "interface" | "type" | "const" | "mod";
  signature: string;
  line: number;
}

const TS_EXPORT_RE =
  /^\s*export\s+(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*)|interface\s+([A-Za-z_$][\w$]*)|type\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)|default\s+function\s+([A-Za-z_$][\w$]*))/gm;
const TS_DECL_RE =
  /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
const PY_DEF_RE = /^\s*(?:def|class)\s+([A-Za-z_][\w]*)/gm;
const RUST_FN_RE = /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([A-Za-z_][\w]*)/gm;
const RUST_STRUCT_RE = /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:struct|enum|trait|mod|type)\s+([A-Za-z_][\w]*)/gm;
const GO_FUNC_RE = /^\s*func\s+(?:\([^)]*\)\s+)?([A-Za-z_][\w]*)/gm;

/** Extract exported/top-level symbols with line numbers. Never throws. */
export function extractSymbols(path: string, content: string): SymbolInfo[] {
  const out: SymbolInfo[] = [];
  try {
    const lines = content.split("\n");
    const push = (name: string | undefined, kind: SymbolInfo["kind"], line: number) => {
      if (!name) return;
      const sig = (lines[line - 1] ?? "").trim().slice(0, 160);
      out.push({ name, kind, signature: sig, line });
    };
    if (/\.tsx?$|\.jsx?$|\.mts$|\.cts$/.test(path)) {
      for (const m of content.matchAll(TS_EXPORT_RE)) {
        const name = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6];
        const kind: SymbolInfo["kind"] = m[2]
          ? "class"
          : m[3]
            ? "interface"
            : m[4]
              ? "type"
              : m[5]
                ? "const"
                : "function";
        const idx = m.index ?? 0;
        push(name, kind, content.slice(0, idx).split("\n").length);
      }
      // non-exported functions help references fallback; keep capped
      if (out.length < 40) {
        for (const m of content.matchAll(TS_DECL_RE)) {
          if (out.some((s) => s.name === m[1])) continue;
          if (out.length >= 60) break;
          const idx = m.index ?? 0;
          push(m[1], "function", content.slice(0, idx).split("\n").length);
        }
      }
    } else if (/\.py$/.test(path)) {
      for (const m of content.matchAll(PY_DEF_RE)) {
        const idx = m.index ?? 0;
        push(m[1], "function", content.slice(0, idx).split("\n").length);
        if (out.length >= 60) break;
      }
    } else if (/\.rs$/.test(path)) {
      for (const m of content.matchAll(RUST_FN_RE)) {
        const idx = m.index ?? 0;
        push(m[1], "function", content.slice(0, idx).split("\n").length);
        if (out.length >= 60) break;
      }
      for (const m of content.matchAll(RUST_STRUCT_RE)) {
        const idx = m.index ?? 0;
        push(m[1], "class", content.slice(0, idx).split("\n").length);
        if (out.length >= 80) break;
      }
    } else if (/\.go$/.test(path)) {
      for (const m of content.matchAll(GO_FUNC_RE)) {
        const idx = m.index ?? 0;
        push(m[1], "function", content.slice(0, idx).split("\n").length);
        if (out.length >= 60) break;
      }
    }
  } catch {
    return out;
  }
  return out.slice(0, 80);
}

const TS_IMPORT_RE =
  /(?:import\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["'])|(?:require\(\s*["']([^"']+)["']\s*\))|(?:import\(\s*["']([^"']+)["']\s*\))/g;
const PY_IMPORT_RE = /^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.,\s]+))/gm;
const RUST_USE_RE = /^\s*use\s+([A-Za-z_][\w:]*(?:::\{[^}]*\})?[^;]*);/gm;
const GO_IMPORT_RE = /"([^"]+)"/g;

/** Raw import specifiers in a file. Never throws. */
export function parseImportSpecs(path: string, content: string): string[] {
  const specs: string[] = [];
  try {
    if (/\.tsx?$|\.jsx?$|\.mts$|\.cts$/.test(path)) {
      for (const m of content.matchAll(TS_IMPORT_RE)) {
        const s = m[1] ?? m[2] ?? m[3];
        if (s) specs.push(s);
      }
    } else if (/\.py$/.test(path)) {
      for (const m of content.matchAll(PY_IMPORT_RE)) {
        const s = (m[1] ?? m[2] ?? "").split(",")[0]?.trim().replace(/\./g, "/");
        if (s) specs.push(s);
      }
    } else if (/\.rs$/.test(path)) {
      for (const m of content.matchAll(RUST_USE_RE)) {
        const s = (m[1] ?? "").trim();
        if (s) specs.push(s);
      }
    } else if (/\.go$/.test(path)) {
      // only relative-ish or quoted paths; bare stdlib ignored downstream
      const block = content.match(/import\s*\([\s\S]*?\)/);
      const src = block ? block[0] : content.split("\n").slice(0, 30).join("\n");
      for (const m of src.matchAll(GO_IMPORT_RE)) {
        if (m[1]) specs.push(m[1]);
      }
    }
  } catch {
    return specs;
  }
  return specs.slice(0, 200);
}

function normalize(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

function dirOf(p: string): string {
  const n = normalize(p);
  const i = n.lastIndexOf("/");
  return i < 0 ? "" : n.slice(0, i);
}

const EXT_CANDIDATES = ["", ".ts", ".tsx", ".js", ".jsx", ".mts", ".py", ".go", ".rs"];
const INDEX_CANDIDATES = ["index.ts", "index.tsx", "index.js", "__init__.py", "mod.rs"];

/** Resolve a relative spec to a known file path, or null. Pure. */
export function resolveRelativeImport(
  fromFile: string,
  spec: string,
  known: Set<string>,
): string | null {
  if (!spec.startsWith(".")) return null; // bare/external: not repo edges
  const base = dirOf(fromFile);
  const joined = normalize(base ? `${base}/${spec}` : spec);
  const parts = joined.split("/");
  const stack: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") stack.pop();
    else stack.push(p);
  }
  const clean = stack.join("/");
  for (const ext of EXT_CANDIDATES) {
    const c = clean + ext;
    if (known.has(c)) return c;
  }
  for (const idx of INDEX_CANDIDATES) {
    const c = `${clean}/${idx}`;
    if (known.has(c)) return c;
  }
  // strip known extension the importer included
  if (known.has(clean)) return clean;
  return null;
}

export interface ImportGraph {
  files: string[];
  edges: Map<string, string[]>;
  reverse: Map<string, Set<string>>;
}

/** Build import graph over entries. Only relative imports become edges. */
export function buildImportGraph(entries: FileEntry[]): ImportGraph {
  const files = entries.map((e) => normalize(e.path));
  const known = new Set(files);
  const edges = new Map<string, string[]>();
  const reverse = new Map<string, Set<string>>();
  for (const f of files) reverse.set(f, new Set());
  for (const e of entries) {
    const from = normalize(e.path);
    const specs = parseImportSpecs(e.path, e.content);
    const outs: string[] = [];
    for (const s of specs) {
      const r = resolveRelativeImport(from, s, known);
      if (r && r !== from && !outs.includes(r)) outs.push(r);
    }
    edges.set(from, outs);
    for (const t of outs) reverse.get(t)?.add(from);
  }
  return { files, edges, reverse };
}

/** Transitive reverse dependents of changed files, up to depth. */
export function reverseDeps(graph: ImportGraph, changed: string[], depth: number): Set<string> {
  const seen = new Set<string>();
  let frontier = changed.map(normalize).filter((c) => graph.reverse.has(c));
  for (const c of frontier) seen.add(c);
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const f of frontier) {
      for (const dep of graph.reverse.get(f) ?? []) {
        if (!seen.has(dep)) {
          seen.add(dep);
          next.push(dep);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return seen;
}

/** PageRank over import graph (edge A->B = A depends on B). Falls back to size order on degenerate graphs. */
export function pageRank(graph: ImportGraph, iterations = 20, damping = 0.85): Map<string, number> {
  const n = graph.files.length;
  const scores = new Map<string, number>();
  if (n === 0) return scores;
  for (const f of graph.files) scores.set(f, 1 / n);
  // B depends on A if edge B->A; rank flows to dependencies (A gains from importers)
  for (let it = 0; it < iterations; it++) {
    const next = new Map<string, number>();
    for (const f of graph.files) next.set(f, (1 - damping) / n);
    for (const [from, outs] of graph.edges) {
      const s = scores.get(from) ?? 0;
      if (outs.length === 0) {
        // dangling: distribute evenly
        for (const f of graph.files) next.set(f, (next.get(f) ?? 0) + (damping * s) / n);
      } else {
        for (const t of outs) next.set(t, (next.get(t) ?? 0) + (damping * s) / outs.length);
      }
    }
    for (const [k, v] of next) scores.set(k, v);
  }
  return scores;
}

/** Minimal glob match supporting **, *, ? over /-separated paths. Pure. */
export function globMatch(glob: string, path: string): boolean {
  const g = glob.replace(/\\/g, "/").replace(/^\.\//, "");
  const p = path.replace(/\\/g, "/").replace(/^\.\//, "");
  // escape regex except * ? then expand ** first
  let re = "";
  let i = 0;
  while (i < g.length) {
    const c = g[i] ?? "";
    if (c === "*") {
      if (g[i + 1] === "*") {
        re += ".*";
        i += 2;
        if (g[i] === "/") i++; // **/ eats slash
      } else {
        re += "[^/]*";
        i++;
      }
    } else if (c === "?") {
      re += "[^/]";
      i++;
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
      i++;
    }
  }
  try {
    return new RegExp(`^${re}$`).test(p);
  } catch {
    return false;
  }
}

export function estimateMarkdownTokens(md: string): number {
  return estimateTokens(md);
}
