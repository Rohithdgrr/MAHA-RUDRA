/** api_schema: cross-service contract introspection (OpenAPI/GraphQL/proto-lite). */
import { ToolError } from "./types";

export type ApiKind = "openapi" | "graphql" | "proto" | "tauri";

export interface ApiSchemaInput {
  source: "url" | "file" | "registry";
  spec?: string;
  spec_url?: string;
  operation?: string;
  service?: string;
  loader?: () => Promise<string>;
}

export interface ApiSchemaResult {
  kind: ApiKind;
  operations: Array<{ name: string; input?: string; output?: string; docs?: string }>;
  types: Array<{ name: string; fields: string[] }>;
  note?: string;
}

function detectKind(spec: string, hint?: string): ApiKind {
  const t = spec.trim();
  if (hint === "tauri" || /@tauri-apps\/api|invoke\(/.test(t.slice(0, 2000))) return "tauri";
  if (t.startsWith("{")) {
    try {
      const j = JSON.parse(t) as Record<string, unknown>;
      if (j["openapi"] || j["swagger"] || j["paths"]) return "openapi";
    } catch {
      // fall through
    }
  }
  if (/^\s*syntax\s*=\s*"proto3"|^\s*message\s+\w+|^\s*service\s+\w+/m.test(t)) return "proto";
  if (/\btype\s+(Query|Mutation)\b|^\s*type\s+\w+\s*\{/m.test(t)) return "graphql";
  return "openapi";
}

function resolveRefs(obj: unknown, root: unknown, depth = 0): unknown {
  if (depth > 10 || obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((x) => resolveRefs(x, root, depth + 1));
  const rec = obj as Record<string, unknown>;
  if (typeof rec["$ref"] === "string") {
    const ref = rec["$ref"] as string;
    const m = ref.match(/^#\/components\/schemas\/([^/]+)$/) || ref.match(/^#\/definitions\/([^/]+)$/);
    const name = m?.[1];
    const rootRec = root as Record<string, unknown>;
    const comps = rootRec["components"] as Record<string, unknown> | undefined;
    const schemas = comps?.["schemas"] as Record<string, unknown> | undefined;
    const defs = rootRec["definitions"] as Record<string, unknown> | undefined;
    const target = name ? (schemas?.[name] ?? defs?.[name]) : undefined;
    return target ? resolveRefs(target, root, depth + 1) : obj;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) out[k] = resolveRefs(v, root, depth + 1);
  return out;
}

function parseOpenApi(spec: string, operation?: string): ApiSchemaResult {
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(spec) as Record<string, unknown>;
  } catch {
    throw new ToolError("BAD_INPUT", "OpenAPI spec is not valid JSON");
  }
  const paths = (j["paths"] ?? {}) as Record<string, Record<string, Record<string, unknown>>>;
  const operations: ApiSchemaResult["operations"] = [];
  for (const [p, methods] of Object.entries(paths)) {
    if (!methods || typeof methods !== "object") continue;
    for (const [method, op] of Object.entries(methods)) {
      const name = `${method.toUpperCase()} ${p}`;
      if (operation && !name.toLowerCase().includes(operation.toLowerCase())) continue;
      operations.push({
        name,
        input: JSON.stringify(resolveRefs(op["requestBody"] ?? op["parameters"] ?? {}, j)).slice(0, 2000),
        output: JSON.stringify(resolveRefs(op["responses"] ?? {}, j)).slice(0, 2000),
        docs: String(op["summary"] ?? op["description"] ?? "").slice(0, 500),
      });
      if (operations.length >= 100) break;
    }
  }
  const schemas = ((j["components"] as Record<string, unknown> | undefined)?.["schemas"] ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const types = Object.entries(schemas)
    .slice(0, 100)
    .map(([name, s]) => ({
      name,
      fields: Object.keys((s as Record<string, unknown>)["properties"] as Record<string, unknown> | undefined ?? {}),
    }));
  return { kind: "openapi", operations: operations.slice(0, 100), types };
}

function parseGraphql(spec: string, operation?: string): ApiSchemaResult {
  const types: ApiSchemaResult["types"] = [];
  for (const m of spec.matchAll(/type\s+(\w+)\s*\{([^}]*)\}/g)) {
    const name = m[1] ?? "";
    const fields = (m[2] ?? "")
      .split("\n")
      .map((l) => l.trim().split(/[(:\s]/)[0]?.trim() ?? "")
      .filter(Boolean);
    types.push({ name, fields: fields.slice(0, 50) });
    if (types.length >= 100) break;
  }
  const ops: ApiSchemaResult["operations"] = [];
  for (const m of spec.matchAll(/(?:query|mutation|subscription)\s+(\w+)/g)) {
    const name = m[1] ?? "";
    if (operation && !name.toLowerCase().includes(operation.toLowerCase())) continue;
    ops.push({ name });
  }
  return { kind: "graphql", operations: ops.slice(0, 100), types };
}

function parseProto(spec: string, service?: string): ApiSchemaResult {
  const types: ApiSchemaResult["types"] = [];
  for (const m of spec.matchAll(/message\s+(\w+)\s*\{([^}]*)\}/g)) {
    const fields = (m[2] ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("//"))
      .slice(0, 50);
    types.push({ name: m[1] ?? "", fields });
  }
  const operations: ApiSchemaResult["operations"] = [];
  for (const m of spec.matchAll(/service\s+(\w+)\s*\{([^}]*)\}/g)) {
    const svc = m[1] ?? "";
    if (service && svc !== service) continue;
    for (const r of (m[2] ?? "").matchAll(/rpc\s+(\w+)\s*\(([^)]*)\)\s*returns\s*\(([^)]*)\)/g)) {
      operations.push({ name: `${svc}.${r[1] ?? ""}`, input: (r[2] ?? "").trim(), output: (r[3] ?? "").trim() });
    }
  }
  return { kind: "proto", operations: operations.slice(0, 100), types: types.slice(0, 100) };
}

function parseTauri(commands: Array<{ name: string; args?: string }>): ApiSchemaResult {
  return {
    kind: "tauri",
    operations: commands.map((c) => ({ name: c.name, input: c.args })),
    types: [],
    note: "Tauri IPC commands exposed to the webview",
  };
}

/** Extract `invoke("cmd", {...})` call sites + `#[tauri::command]` defs from sources. */
export function extractTauriCommands(files: Array<{ path: string; content: string }>): Array<{ name: string; args?: string }> {
  const out = new Map<string, { name: string; args?: string }>();
  for (const f of files) {
    if (/\.rs$/.test(f.path)) {
      for (const m of f.content.matchAll(/#\[tauri::command\][\s\S]{0,200}?fn\s+(\w+)\s*\(([^)]*)\)/g)) {
        const name = m[1] ?? "";
        if (name && !out.has(name)) out.set(name, { name, args: (m[2] ?? "").trim().slice(0, 500) });
      }
    } else if (/\.[jt]sx?$/.test(f.path)) {
      for (const m of f.content.matchAll(/invoke\(\s*["']([^"']+)["']\s*(?:,\s*(\{[\s\S]{0,500}?\}))?/g)) {
        const name = m[1] ?? "";
        if (name && !out.has(name)) out.set(name, { name, args: m[2]?.slice(0, 500) });
      }
    }
  }
  return [...out.values()].slice(0, 200);
}

export async function apiSchema(input: ApiSchemaInput): Promise<ApiSchemaResult> {
  let spec = (input.spec ?? "").trim();
  if (!spec && input.loader) {
    try {
      spec = (await input.loader()).trim();
    } catch (e) {
      throw new ToolError("EXEC_FAILED", `spec load failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (!spec) throw new ToolError("BAD_INPUT", "no spec provided (spec, spec_url fetch, or loader)");
  if (spec.length > 1_000_000) throw new ToolError("BAD_INPUT", "spec too large");
  const kind = detectKind(spec, input.service === "tauri" ? "tauri" : undefined);
  if (kind === "openapi") return parseOpenApi(spec, input.operation);
  if (kind === "graphql") return parseGraphql(spec, input.operation);
  if (kind === "proto") return parseProto(spec, input.service);
  return parseTauri([]);
}
