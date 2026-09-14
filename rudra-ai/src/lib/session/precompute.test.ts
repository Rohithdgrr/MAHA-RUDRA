import { describe, expect, it } from "vitest";
import { digestEntries, isFresh, precomputeSession } from "./precompute";

const entries = [
  { path: "src/api/users.ts", content: "import {db} from '../db';\nexport function getUser() {}\n" },
  { path: "src/db.ts", content: "export const db = {};\nconst url = process.env.DB_URL;\n" },
];

describe("precomputeSession", () => {
  it("builds map + graph + env refs in one pass", () => {
    const b = precomputeSession(entries);
    expect(b.fileCount).toBe(2);
    expect(b.repoMapMarkdown).toContain("src/db.ts");
    expect(b.graphFiles).toContain("src/db.ts");
    expect(b.envRefs).toContain("DB_URL");
    expect(typeof b.at).toBe("number");
  });
  it("digest is stable and order-independent", () => {
    expect(digestEntries(entries)).toBe(digestEntries([...entries].reverse()));
  });
  it("isFresh detects drift", () => {
    const b = precomputeSession(entries);
    expect(isFresh(b, entries)).toBe(true);
    expect(isFresh(b, [...entries, { path: "src/new.ts", content: "x" }])).toBe(false);
    expect(isFresh(b, entries.map((e) => (e.path === "src/db.ts" ? { ...e, content: "changed" } : e)))).toBe(false);
  });
  it("handles empty workspaces", () => {
    const b = precomputeSession([]);
    expect(b.fileCount).toBe(0);
    expect(b.envRefs).toEqual([]);
    expect(isFresh(b, [])).toBe(true);
  });
  it("focus boosts relevant files", () => {
    const b = precomputeSession(entries, { focus: ["src/api/**"], mapTokens: 500 });
    expect(b.repoMapMarkdown).toContain("users.ts");
  });
});
