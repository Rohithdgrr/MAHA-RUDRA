/** dep_graph: audit + why + upgrade impact. Wraps registry scanners; pure parsers included. */
import type { FileEntry } from "./import-graph";
import { fallbackSearch } from "./search-symbols";
import { ToolError } from "./types";

export type DepOp = "tree" | "why" | "outdated" | "audit" | "upgrade_impact";

export interface DepInput {
  op: DepOp;
  package?: string;
  ecosystem?: "auto" | "npm" | "cargo" | "pip" | "go" | "maven";
}

export interface Vuln {
  package: string;
  version: string;
  cve: string;
  severity: string;
  fix_version?: string;
  path?: string;
}

export interface DepRunner {
  npmAudit?(): Promise<unknown>;
  cargoAudit?(): Promise<unknown>;
  osvScan?(): Promise<unknown>;
  listDeps?(ecosystem: string): Promise<Array<{ name: string; version: string; dependsOn?: string[] }>>;
}

/** Parse `npm audit --json` advisories/vulnerabilities. Tolerant. */
export function parseNpmAudit(raw: unknown): Vuln[] {
  const out: Vuln[] = [];
  try {
    const j = raw as Record<string, unknown>;
    const adv = (j["advisories"] ?? j["vulnerabilities"] ?? {}) as Record<string, unknown>;
    for (const [, v] of Object.entries(adv)) {
      const r = v as Record<string, unknown>;
      out.push({
        package: String(r["module_name"] ?? r["name"] ?? "unknown"),
        version: String(r["version"] ?? (r["range"] as string | undefined) ?? "unknown"),
        cve: String((r["cves"] as string[] | undefined)?.[0] ?? r["url"] ?? r["title"] ?? "unknown"),
        severity: String(r["severity"] ?? "unknown"),
        fix_version: typeof r["fixed_in"] === "string" ? (r["fixed_in"] as string) : undefined,
        path: typeof r["path"] === "string" ? (r["path"] as string) : undefined,
      });
    }
    const vulns = (j["vulnerabilities"] as Array<Record<string, unknown>> | undefined) ?? [];
    if (Array.isArray(vulns)) {
      for (const r of vulns) {
        out.push({
          package: String(r["package"] ?? "unknown"),
          version: String(r["version"] ?? "unknown"),
          cve: String(r["cve"] ?? r["id"] ?? "unknown"),
          severity: String(r["severity"] ?? "unknown"),
          fix_version: typeof r["fix_version"] === "string" ? (r["fix_version"] as string) : undefined,
        });
      }
    }
  } catch {
    return out;
  }
  return out.slice(0, 200);
}

/** Parse `cargo audit --json` vulnerabilities list. */
export function parseCargoAudit(raw: unknown): Vuln[] {
  try {
    const j = raw as { vulnerabilities?: { list?: Array<Record<string, unknown>> } };
    const list = j.vulnerabilities?.list ?? [];
    return list.slice(0, 200).map((v) => ({
      package: String((v["package"] as Record<string, unknown> | undefined)?.["name"] ?? "unknown"),
      version: String((v["package"] as Record<string, unknown> | undefined)?.["version"] ?? "unknown"),
      cve: String((v["advisory"] as Record<string, unknown> | undefined)?.["id"] ?? "unknown"),
      severity: String((v["advisory"] as Record<string, unknown> | undefined)?.["severity"] ?? "unknown"),
      fix_version: undefined,
    }));
  } catch {
    return [];
  }
}

export interface DepResult {
  op: DepOp;
  vulns?: Vuln[];
  chain?: string[];
  affectedFiles?: string[];
  note?: string;
}

export async function depGraph(
  runner: DepRunner,
  entries: FileEntry[],
  input: DepInput,
): Promise<DepResult> {
  if ((input.op === "why" || input.op === "upgrade_impact") && !input.package?.trim())
    throw new ToolError("BAD_INPUT", `${input.op} requires package`);
  switch (input.op) {
    case "audit": {
      const vulns: Vuln[] = [];
      if (runner.npmAudit) {
        try {
          vulns.push(...parseNpmAudit(await runner.npmAudit()));
        } catch {
          // scanner failed — continue with others
        }
      }
      if (runner.cargoAudit) {
        try {
          vulns.push(...parseCargoAudit(await runner.cargoAudit()));
        } catch {
          // ignore
        }
      }
      if (runner.osvScan) {
        try {
          vulns.push(...parseNpmAudit(await runner.osvScan()));
        } catch {
          // ignore
        }
      }
      return { op: "audit", vulns };
    }
    case "why": {
      const pkg = (input.package as string).trim();
      const deps = runner.listDeps
        ? await runner.listDeps(input.ecosystem ?? "auto").catch(() => [])
        : [];
      // BFS over dependsOn edges to find chain to pkg
      const byName = new Map(deps.map((d) => [d.name, d]));
      const chain: string[] = [pkg];
      let cur = byName.get(pkg);
      let guard = 0;
      while (cur && guard++ < 20) {
        const parent = deps.find((d) => d.dependsOn?.includes(cur?.name ?? ""));
        if (!parent) break;
        chain.unshift(parent.name);
        cur = parent;
      }
      if (deps.length === 0) {
        // fallback: textual search for package name in manifests
        const hits = entries
          .filter((e) => /package\.json|Cargo\.(toml|lock)|requirements/.test(e.path))
          .filter((e) => e.content.includes(pkg))
          .map((e) => e.path);
        return { op: "why", chain, affectedFiles: hits, note: hits.length ? undefined : "no manifest references found" };
      }
      return { op: "why", chain };
    }
    case "upgrade_impact": {
      const pkg = (input.package as string).trim();
      // call sites of the package / its likely exports via fallback symbol search
      const locs = fallbackSearch(entries, { query: pkg.replace(/^@[^/]+\//, "").split("/")[0] ?? pkg, kind: "references" });
      return {
        op: "upgrade_impact",
        affectedFiles: [...new Set(locs.map((l) => l.file))].slice(0, 50),
        note: "review listed call sites against the new major's changelog",
      };
    }
    case "tree":
    case "outdated": {
      const deps = runner.listDeps
        ? await runner.listDeps(input.ecosystem ?? "auto").catch(() => [])
        : [];
      return {
        op: input.op,
        affectedFiles: deps.map((d) => `${d.name}@${d.version}`).slice(0, 200),
        note: deps.length ? undefined : "no dependency lister configured",
      };
    }
  }
}
