/** lint_typecheck: structured diagnostics before tests. Parsers are pure; runners injected. */
import { ToolError } from "./types";

export type Severity = "error" | "warning" | "all";
export type DiagSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  file: string;
  line: number;
  col: number;
  severity: DiagSeverity;
  rule: string;
  message: string;
  autofixable: boolean;
}

export interface LintInput {
  paths?: string[];
  fix?: boolean;
  severity?: Severity;
}

export interface CheckerRunner {
  tsc?: (paths?: string[]) => Promise<unknown>;
  eslint?: (paths?: string[]) => Promise<unknown>;
  ruff?: (paths?: string[]) => Promise<unknown>;
  cargo?: (paths?: string[]) => Promise<unknown>;
  applyFixes?: (paths?: string[]) => Promise<number>;
}

/** Parse `tsc --pretty false` lines: file(line,col): error TS123: msg */
export function parseTscOutput(text: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+TS(\d+):\s+(.*)$/);
    if (!m) continue;
    out.push({
      file: (m[1] ?? "").trim(),
      line: parseInt(m[2] ?? "1", 10),
      col: parseInt(m[3] ?? "1", 10),
      severity: m[4] === "warning" ? "warning" : "error",
      rule: `TS${m[5] ?? ""}`,
      message: (m[6] ?? "").trim().slice(0, 500),
      autofixable: false,
    });
  }
  return out;
}

/** Parse `eslint -f json` array. Tolerant of malformed input. */
export function parseEslintJson(raw: unknown): Diagnostic[] {
  if (!Array.isArray(raw)) return [];
  const out: Diagnostic[] = [];
  for (const f of raw as Array<Record<string, unknown>>) {
    const file = String(f["filePath"] ?? f["file"] ?? "unknown");
    const msgs = Array.isArray(f["messages"]) ? (f["messages"] as Array<Record<string, unknown>>) : [];
    for (const m of msgs) {
      const sev = m["severity"] === 1 ? "warning" : "error";
      out.push({
        file,
        line: typeof m["line"] === "number" ? m["line"] : 1,
        col: typeof m["column"] === "number" ? m["column"] : 1,
        severity: sev,
        rule: String(m["ruleId"] ?? "eslint"),
        message: String(m["message"] ?? "").slice(0, 500),
        autofixable: Boolean(m["fix"]),
      });
    }
  }
  return out;
}

/** Parse `ruff --output-format json` array. */
export function parseRuffJson(raw: unknown): Diagnostic[] {
  if (!Array.isArray(raw)) return [];
  const out: Diagnostic[] = [];
  for (const r of raw as Array<Record<string, unknown>>) {
    const loc = r["location"] as Record<string, unknown> | undefined;
    out.push({
      file: String(r["filename"] ?? "unknown"),
      line: typeof loc?.["row"] === "number" ? (loc["row"] as number) : 1,
      col: typeof loc?.["column"] === "number" ? (loc["column"] as number) : 1,
      severity: "error",
      rule: String(r["code"] ?? "ruff"),
      message: String(r["message"] ?? "").slice(0, 500),
      autofixable: Boolean(r["fix"]),
    });
  }
  return out;
}

/** Parse `cargo check --message-format json` line-delimited records. */
export function parseCargoCheck(text: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("{")) continue;
    try {
      const rec = JSON.parse(t) as Record<string, unknown>;
      if (rec["reason"] !== "compiler-message") continue;
      const msg = rec["message"] as Record<string, unknown> | undefined;
      if (!msg) continue;
      const level = String(msg["level"] ?? "error");
      if (level !== "error" && level !== "warning") continue;
      const spans = (msg["spans"] as Array<Record<string, unknown>> | undefined) ?? [];
      const primary = spans.find((s) => s["is_primary"]) ?? spans[0];
      out.push({
        file: String(primary?.["file_name"] ?? "unknown"),
        line: typeof primary?.["line_start"] === "number" ? (primary["line_start"] as number) : 1,
        col: typeof primary?.["column_start"] === "number" ? (primary["column_start"] as number) : 1,
        severity: level === "warning" ? "warning" : "error",
        rule: String(msg["code"] ? (msg["code"] as Record<string, unknown>)["code"] ?? "rustc" : "rustc"),
        message: String(msg["message"] ?? msg["rendered"] ?? "").slice(0, 500),
        autofixable: false,
      });
    } catch {
      continue; // skip malformed lines
    }
  }
  return out;
}

function detectCheckers(paths: string[]): Array<"tsc" | "eslint" | "ruff" | "cargo"> {
  const set = new Set<"tsc" | "eslint" | "ruff" | "cargo">();
  for (const p of paths) {
    if (/\.[jt]sx?$/.test(p)) {
      set.add("tsc");
      set.add("eslint");
    } else if (/\.py$/.test(p)) set.add("ruff");
    else if (/\.rs$/.test(p)) set.add("cargo");
  }
  if (paths.length === 0) {
    set.add("tsc");
    set.add("cargo");
  }
  return [...set];
}

export interface LintResult {
  diagnostics: Diagnostic[];
  fixApplied: boolean;
  fixesApplied?: number;
  checkers: string[];
  note?: string;
}

export async function lintTypecheck(
  runner: CheckerRunner,
  input: LintInput = {},
): Promise<LintResult> {
  const severity = input.severity ?? "error";
  if (severity !== "error" && severity !== "warning" && severity !== "all")
    throw new ToolError("BAD_INPUT", "severity must be error|warning|all");
  const paths = input.paths ?? [];
  const checkers = detectCheckers(paths);
  const diags: Diagnostic[] = [];
  const available: string[] = [];
  if (checkers.includes("tsc") && runner.tsc) {
    available.push("tsc");
    try {
      const raw = await runner.tsc(paths.length ? paths : undefined);
      if (typeof raw === "string") diags.push(...parseTscOutput(raw));
    } catch {
      // checker failed — record nothing, keep other checkers
    }
  }
  if (checkers.includes("eslint") && runner.eslint) {
    available.push("eslint");
    try {
      diags.push(...parseEslintJson(await runner.eslint(paths.length ? paths : undefined)));
    } catch {
      // ignore
    }
  }
  if (checkers.includes("ruff") && runner.ruff) {
    available.push("ruff");
    try {
      diags.push(...parseRuffJson(await runner.ruff(paths.length ? paths : undefined)));
    } catch {
      // ignore
    }
  }
  if (checkers.includes("cargo") && runner.cargo) {
    available.push("cargo");
    try {
      const raw = await runner.cargo(paths.length ? paths : undefined);
      if (typeof raw === "string") diags.push(...parseCargoCheck(raw));
    } catch {
      // ignore
    }
  }
  let fixApplied = false;
  let fixesApplied: number | undefined;
  if (input.fix) {
    if (runner.applyFixes) {
      try {
        fixesApplied = await runner.applyFixes(paths.length ? paths : undefined);
        fixApplied = (fixesApplied ?? 0) > 0;
      } catch {
        fixApplied = false;
      }
    }
  }
  const filtered =
    severity === "all" ? diags : diags.filter((d) => (severity === "error" ? d.severity === "error" : d.severity !== "info"));
  filtered.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return {
    diagnostics: filtered.slice(0, 200),
    fixApplied,
    fixesApplied,
    checkers: available,
    note: available.length === 0 ? "no checkers available for given paths" : undefined,
  };
}
