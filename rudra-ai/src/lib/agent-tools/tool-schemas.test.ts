import { describe, expect, it } from "vitest";
import { TOOL_CATALOG, resolveSessionTools, twoTierSchemas } from "./tool-schemas";
import { ALL_TOOLS } from "./capability-gates";

describe("TOOL_CATALOG", () => {
  it("covers every gated tool with blurb + params + example", () => {
    for (const name of ALL_TOOLS) {
      const e = TOOL_CATALOG[name];
      expect(e, name).toBeDefined();
      expect(e?.blurb.length ?? 0).toBeGreaterThan(10);
      expect(e?.params.length ?? 0).toBeGreaterThan(0);
      expect(e?.example ?? "").toContain(name.split("_")[0] ?? name);
    }
  });
  it("examples stay one-liners (schema tax discipline)", () => {
    for (const e of Object.values(TOOL_CATALOG)) {
      expect(e.example.includes("\n")).toBe(false);
    }
  });
});

describe("twoTierSchemas", () => {
  const gated = ["repo_map", "batch_edit", "run_verify"] as const;
  it("promotes recent tools to full, demotes the rest", () => {
    const t = twoTierSchemas([...gated], ["run_verify"]);
    expect(t.full.map((f) => f.name)).toEqual(["run_verify"]);
    expect(t.terse.map((x) => x.name)).toEqual(["repo_map", "batch_edit"]);
    expect(t.full[0]?.params).toContain("cmd");
  });
  it("keeps only the last N recent tools", () => {
    const t = twoTierSchemas([...gated], ["repo_map", "batch_edit", "run_verify", "repo_map"], 2);
    expect(t.full.map((f) => f.name).sort()).toEqual(["repo_map", "run_verify"]);
  });
  it("ignores unknown tool names", () => {
    const t = twoTierSchemas([...gated], ["nope", "run_verify"]);
    expect(t.full.map((f) => f.name)).toEqual(["run_verify"]);
  });
  it("empty recent → all terse", () => {
    const t = twoTierSchemas([...gated], []);
    expect(t.full).toEqual([]);
    expect(t.terse).toHaveLength(3);
  });
});

describe("resolveSessionTools", () => {
  it("gates + tiers in one call for a frontend repo", () => {
    const r = resolveSessionTools(["package.json", "src/components/A.tsx"]);
    expect(r.gated).toContain("visual_verify");
    expect(r.gated).not.toContain("db_schema");
    expect(r.tiers.terse.length).toBe(r.gated.length);
  });
  it("recent use promotes within the gated set", () => {
    const r = resolveSessionTools(["package.json"], ["env_audit"]);
    expect(r.tiers.full.map((f) => f.name)).toEqual(["env_audit"]);
  });
});
