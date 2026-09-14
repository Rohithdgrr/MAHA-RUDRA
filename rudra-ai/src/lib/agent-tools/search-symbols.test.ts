import { describe, expect, it } from "vitest";
import { fallbackSearch, searchSymbols } from "./search-symbols";
import { ToolError } from "./types";

const entries = [
  { path: "src/a.ts", content: "export function getUser() {}\n// getUser in comment\nconst x = getUser();\n" },
  { path: "src/b.ts", content: "import { getUser } from './a';\ngetUserById(1);\n" },
];

describe("search-symbols", () => {
  it("definition finds declarations, not plain calls", () => {
    const defs = fallbackSearch(entries, { query: "getUser", kind: "definition" });
    expect(defs.length).toBeGreaterThan(0);
    expect(defs.every((d) => /function|class|const|let/.test(d.signature))).toBe(true);
    // `const x = getUser()` call site must NOT count as a definition
    expect(defs.some((d) => d.signature.includes("const x ="))).toBe(false);
  });
  it("references finds word-boundary matches incl. call sites", () => {
    const refs = fallbackSearch(entries, { query: "getUser", kind: "references" });
    expect(refs.length).toBeGreaterThanOrEqual(2);
  });
  it("uses LSP when available", async () => {
    const r = await searchSymbols(entries, { query: "getUser", kind: "hover" }, {
      request: async () => [{ file: "src/a.ts", line: 1, character: 0, signature: "fn", kind: "hover" }],
    });
    expect(r.via).toBe("lsp");
    expect(r.locations).toHaveLength(1);
  });
  it("falls back when LSP throws, with reason", async () => {
    const r = await searchSymbols(entries, { query: "getUser", kind: "references" }, {
      request: async () => {
        throw new Error("lsp down");
      },
    });
    expect(r.via).toBe("fallback");
    expect(r.fallbackReason).toContain("lsp down");
    expect(r.locations.length).toBeGreaterThan(0);
  });
  it("falls back with no client", async () => {
    const r = await searchSymbols(entries, { query: "getUser", kind: "references" });
    expect(r.via).toBe("fallback");
  });
  it("rejects empty query and bad positions", async () => {
    await expect(searchSymbols(entries, { query: "  ", kind: "references" })).rejects.toThrow(ToolError);
    await expect(searchSymbols(entries, { query: "x", kind: "references", line: 0 })).rejects.toThrow(ToolError);
    await expect(searchSymbols(entries, { query: "x", kind: "references", character: -1 })).rejects.toThrow(ToolError);
  });
  it("scopes to file when given", () => {
    const refs = fallbackSearch(entries, { query: "getUser", kind: "references", file: "src/b.ts" });
    expect(refs.every((r) => r.file === "src/b.ts")).toBe(true);
  });
});
