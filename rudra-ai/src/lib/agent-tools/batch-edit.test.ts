import { describe, expect, it } from "vitest";
import { applyUnifiedPatch, batchEdit, type FileSystem } from "./batch-edit";
import { ToolError } from "./types";

function memFs(seed: Record<string, string> = {}): FileSystem & { files: Map<string, string> } {
  const files = new Map(Object.entries(seed));
  return {
    files,
    readFile: async (p) => {
      const v = files.get(p);
      if (v === undefined) throw new Error("missing");
      return v;
    },
    writeFile: async (p, c) => {
      files.set(p, c);
    },
    exists: async (p) => files.has(p),
    delete: async (p) => {
      files.delete(p);
    },
  };
}

describe("batch-edit", () => {
  it("applies multi-file edits atomically", async () => {
    const fs = memFs({ "a.ts": "hi", "b.ts": "yo" });
    const r = await batchEdit(fs, {
      edits: [
        { file: "a.ts", op: "replace", content: "hi2" },
        { file: "c.ts", op: "create", content: "new" },
      ],
    });
    expect(r.appliedAll).toBe(true);
    expect(fs.files.get("a.ts")).toBe("hi2");
    expect(fs.files.get("c.ts")).toBe("new");
  });
  it("atomic rollback: failed edit leaves repo untouched", async () => {
    const fs = memFs({ "a.ts": "hi" });
    const r = await batchEdit(fs, {
      edits: [
        { file: "a.ts", op: "replace", content: "hi2" },
        { file: "missing.ts", op: "replace", content: "x" },
      ],
      atomic: true,
    });
    expect(r.appliedAll).toBe(false);
    expect(fs.files.get("a.ts")).toBe("hi");
  });
  it("non-atomic applies the good ones", async () => {
    const fs = memFs({ "a.ts": "hi" });
    const r = await batchEdit(fs, {
      edits: [
        { file: "a.ts", op: "replace", content: "hi2" },
        { file: "missing.ts", op: "replace", content: "x" },
      ],
      atomic: false,
    });
    expect(r.appliedAll).toBe(false);
    expect(fs.files.get("a.ts")).toBe("hi2");
  });
  it("old_string must match exactly once", async () => {
    const fs = memFs({ "a.ts": "foo foo" });
    const r = await batchEdit(fs, {
      edits: [{ file: "a.ts", op: "replace", content: "x", old_string: "foo", new_string: "bar" }],
    });
    expect(r.appliedAll).toBe(false);
    await expect(
      batchEdit(memFs({}), { edits: [{ file: "m.ts", op: "replace", content: "x", old_string: "z", new_string: "y" }] }),
    ).resolves.toMatchObject({ appliedAll: false });
  });
  it("rejects path traversal, absolute paths, empty edits", async () => {
    const fs = memFs({});
    await expect(batchEdit(fs, { edits: [] })).rejects.toThrow(ToolError);
    await expect(batchEdit(fs, { edits: [{ file: "../evil.ts", op: "create", content: "x" }] })).rejects.toThrow(
      ToolError,
    );
    await expect(
      batchEdit(fs, { edits: [{ file: "/abs.ts", op: "create", content: "x" }] }),
    ).rejects.toThrow(ToolError);
  });
  it("create conflicts when file exists; delete missing errors", async () => {
    const fs = memFs({ "a.ts": "x" });
    const r1 = await batchEdit(fs, { edits: [{ file: "a.ts", op: "create", content: "y" }] });
    expect(r1.appliedAll).toBe(false);
    const r2 = await batchEdit(fs, { edits: [{ file: "no.ts", op: "delete" }] });
    expect(r2.appliedAll).toBe(false);
  });
  it("applyUnifiedPatch applies hunks and detects mismatch", () => {
    const orig = "a\nb\nc\n";
    const patch = "@@ -1,3 +1,3 @@\n a\n-b\n+B2\n c\n";
    expect(applyUnifiedPatch(orig, patch)).toContain("B2");
    expect(() => applyUnifiedPatch(orig, "no hunks")).toThrow(ToolError);
    expect(() => applyUnifiedPatch(orig, "@@ -1,3 +1,3 @@\n a\n-X\n c\n")).toThrow(ToolError);
  });
});
