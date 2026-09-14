/** env_audit: validate runtime env before running. Pure scan + parse; connectivity injected. */
import { ToolError } from "./types";

export interface EnvAuditInput {
  source?: ".env" | ".env.example" | "process" | "auto";
  required?: string[];
  check_connectivity?: boolean;
  envText?: string;
  processEnv?: Record<string, string | undefined>;
  fileContents?: Array<{ path: string; content: string }>;
}

export interface EnvAuditResult {
  present: string[];
  missing: string[];
  invalid: Array<{ key: string; reason: string }>;
  connectivity?: Array<{ key: string; ok: boolean; error?: string }>;
}

const REF_RES = [
  /process\.env\.([A-Z_][A-Z0-9_]*)/g,
  /import\.meta\.env\.(VITE_[A-Z0-9_]*|[A-Z_][A-Z0-9_]*)/g,
  /std::env::var\(\s*"([^"]+)"\s*\)/g,
  /os\.environ(?:\.get)?\(\s*['"]([^'"]+)['"]/g,
  /System\.getenv\(\s*"([^"]+)"\s*\)/g,
];

/** Scan file contents for env var references. Pure. */
export function scanEnvRefs(files: Array<{ path: string; content: string }>): string[] {
  const out = new Set<string>();
  for (const f of files) {
    const src = f.content.slice(0, 200_000);
    for (const re of REF_RES) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        if (m[1]) out.add(m[1]);
        if (out.size > 500) break;
      }
    }
  }
  return [...out].sort();
}

/** Parse .env text (quotes, export prefix, comments). Pure. */
export function parseDotEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const body = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = body.indexOf("=");
    if (eq < 0) continue;
    const key = body.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let val = body.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    } else {
      const hash = val.indexOf(" #");
      if (hash >= 0) val = val.slice(0, hash).trim();
    }
    out[key] = val;
  }
  return out;
}

export type ConnectivityPinger = (key: string, value: string) => Promise<{ ok: boolean; error?: string }>;

export async function envAudit(
  input: EnvAuditInput = {},
  pinger?: ConnectivityPinger,
): Promise<EnvAuditResult> {
  const refs = input.required ?? scanEnvRefs(input.fileContents ?? []);
  const merged: Record<string, string | undefined> = { ...(input.processEnv ?? {}) };
  if (input.envText) Object.assign(merged, parseDotEnv(input.envText));
  // default process env when running under node/vite and caller passed nothing
  if (!input.processEnv && !input.envText) {
    try {
      const g = globalThis as unknown as { process?: { env?: Record<string, string> } };
      const pe = g.process?.env;
      if (pe) for (const [k, v] of Object.entries(pe)) if (!(k in merged)) merged[k] = v;
    } catch {
      // ignore
    }
  }
  const present: string[] = [];
  const missing: string[] = [];
  const invalid: Array<{ key: string; reason: string }> = [];
  for (const key of refs) {
    const v = merged[key];
    if (v === undefined || v === "") missing.push(key);
    else {
      present.push(key);
      if (/(_URL|_ENDPOINT|_HOST)$/.test(key) && /^(https?|tcp|postgres)/.test(v)) {
        try {
          // eslint-disable-next-line no-new -- validate URL shape
          new URL(v.includes("://") ? v : `http://${v}`);
        } catch {
          invalid.push({ key, reason: "URL-shaped value is not a valid URL" });
        }
      }
      if (/PORT/.test(key) && !/^\d+$/.test(v)) invalid.push({ key, reason: "expected numeric port" });
    }
  }
  let connectivity: EnvAuditResult["connectivity"];
  if (input.check_connectivity) {
    if (!pinger) throw new ToolError("BAD_INPUT", "check_connectivity requires a pinger");
    connectivity = [];
    for (const key of present) {
      const v = merged[key];
      if (typeof v === "string" && /^https?:\/\//.test(v)) {
        try {
          connectivity.push({ key, ...(await pinger(key, v)) });
        } catch (e) {
          connectivity.push({ key, ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      }
    }
  }
  return { present, missing, invalid, connectivity };
}
