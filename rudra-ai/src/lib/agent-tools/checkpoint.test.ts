import { describe, expect, it } from "vitest";
import type { FileSystem } from "./batch-edit";
import { MemoryCheckpointStore, checkpoint, restore } from "./checkpoint";
import { ToolError } from "./types";

function memFs(seed: Record<string, string> = {}): FileSystem {
  const files = new Map(Object.entries(seed));
  return {
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

describe("checkpoint/restore", () => {
  it("snapshots and restores edited + deleted files", async () => {
    const fs = memFs({ "a.ts": "v1" });
    const store = new MemoryCheckpointStore();
    const snap = await checkpoint(fs, store, ["a.ts"], { label: "before" });
    await fs.writeFile("a.ts", "v2");
    await fs.writeFile("b.ts", "new");
    const r = await restore(fs, store, snap.id);
    expect(r.restored).toContain("a.ts");
    expect(await fs.readFile("a.ts")).toBe("v1");
  });
  it("restore by label picks latest", async () => {
    const fs = memFs({ "a.ts": "1" });
    const store = new MemoryCheckpointStore();
    await checkpoint(fs, store, ["a.ts"], { label: "x" });
    await fs.writeFile("a.ts", "2");
    await checkpoint(fs, store, ["a.ts"], { label: "x" });
    await fs.writeFile("a.ts", "3");
    await restore(fs, store, "x");
    expect(await fs.readFile("a.ts")).toBe("2");
  });
  it("excludes node_modules/target/.git", async () => {
    const fs = memFs({ "node_modules/a.js": "x", "src/a.ts": "y" });
    const store = new MemoryCheckpointStore();
    const snap = await checkpoint(fs, store, ["node_modules/a.js", "src/a.ts"], { label: "s" });
    expect(snap.files["node_modules/a.js"]).toBeUndefined();
    expect(snap.files["src/a.ts"]).toBe("y");
  });
  it("unknown id errors; empty label rejected", async () => {
    const fs = memFs({});
    const store = new MemoryCheckpointStore();
    await expect(restore(fs, store, "nope")).rejects.toThrow(ToolError);
    await expect(checkpoint(fs, store, [], { label: "  " })).rejects.toThrow(ToolError);
  });
  it("prunes beyond max snapshots", async () => {
    const fs = memFs({ "a.ts": "v" });
    const store = new MemoryCheckpointStore();
    for (let i = 0; i < 25; i++) await checkpoint(fs, store, ["a.ts"], { label: `s${i}` });
    expect(store.list().length).toBeLessThanOrEqual(20);
  });
});
