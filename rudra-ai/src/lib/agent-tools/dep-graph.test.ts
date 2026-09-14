import { describe, expect, it } from "vitest";
import { depGraph, parseCargoAudit, parseNpmAudit } from "./dep-graph";
import { ToolError } from "./types";

describe("depGraph parsers", () => {
  it("parses npm audit shapes", () => {
    const v = parseNpmAudit({ advisories: { "1": { module_name: "x", severity: "high", title: "t" } } });
    expect(v[0]).toMatchObject({ package: "x" });
    expect(parseNpmAudit(null)).toEqual([]);
  });
  it("parses cargo audit shapes", () => {
    const v = parseCargoAudit({ vulnerabilities: { list: [{ package: { name: "p", version: "1" }, advisory: { id: "CVE-1", severity: "high" } }] } });
    expect(v[0]?.cve).toBe("CVE-1");
    expect(parseCargoAudit(null)).toEqual([]);
  });
});

describe("depGraph ops", () => {
  it("audit merges scanners and tolerates failure", async () => {
    const r = await depGraph(
      {
        npmAudit: async () => ({ advisories: {} }),
        cargoAudit: async () => {
          throw new Error("no cargo");
        },
      },
      [],
      { op: "audit" },
    );
    expect(r.vulns).toEqual([]);
  });
  it("why requires package; falls back to manifest grep", async () => {
    await expect(depGraph({}, [], { op: "why" })).rejects.toThrow(ToolError);
    const r = await depGraph({}, [{ path: "package.json", content: `"foo": "1.0.0"` }], { op: "why", package: "foo" });
    expect(r.affectedFiles).toContain("package.json");
  });
  it("upgrade_impact lists call sites", async () => {
    const r = await depGraph(
      {},
      [{ path: "src/a.ts", content: "import foo from 'foo';\nfoo();" }],
      { op: "upgrade_impact", package: "foo" },
    );
    expect(r.affectedFiles).toContain("src/a.ts");
  });
  it("tree/outdated return dep list or note", async () => {
    const r = await depGraph({ listDeps: async () => [{ name: "a", version: "1" }] }, [], { op: "tree" });
    expect(r.affectedFiles?.[0]).toContain("a@1");
    const empty = await depGraph({}, [], { op: "outdated" });
    expect(empty.note).toBeDefined();
  });
});
