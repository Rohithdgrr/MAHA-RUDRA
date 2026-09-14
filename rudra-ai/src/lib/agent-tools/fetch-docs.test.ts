import { describe, expect, it } from "vitest";
import { MemoryDocsCache, chunkMarkdown, fetchDocs, htmlToMarkdown, scoreChunks } from "./fetch-docs";
import { ToolError } from "./types";

describe("fetchDocs helpers", () => {
  it("htmlToMarkdown strips scripts and keeps headings/links", () => {
    const md = htmlToMarkdown(`<script>evil()</script><h1>Title</h1><p>see <a href="https://x">x</a></p>`);
    expect(md).toContain("# Title");
    expect(md).not.toContain("evil()");
  });
  it("chunk + BM25 filter picks relevant chunk", () => {
    const md = "# Apples\n\napples are red\n\n# Cars\n\ncars go fast\n";
    const ranked = scoreChunks(chunkMarkdown(md, 500), "cars fast");
    expect(ranked[0]?.heading).toContain("Cars");
    expect(scoreChunks(chunkMarkdown(md), "")).toHaveLength(2);
  });
});

describe("fetchDocs", () => {
  it("fetches, converts, caches by content hash", async () => {
    const cache = new MemoryDocsCache();
    let calls = 0;
    const fetchFn = async () => {
      calls++;
      return { status: 200, text: "<h1>Hi</h1><p>body text here</p>" };
    };
    const r1 = await fetchDocs(fetchFn, cache, { url: "https://example.com/a", max_tokens: 500 });
    expect(r1.markdown).toContain("Hi");
    expect(r1.fromCache).toBe(false);
    const r2 = await fetchDocs(fetchFn, cache, { url: "https://example.com/a", max_tokens: 500 });
    expect(r2.fromCache).toBe(true);
    expect(calls).toBe(2); // fetch runs, cache short-circuits transform reuse
  });
  it("query filters to relevant section and truncates", async () => {
    const cache = new MemoryDocsCache();
    const text = "# A\n\nalpha one\n\n# B\n\nbeta two\n";
    const r = await fetchDocs(async () => ({ status: 200, text }), cache, {
      url: "https://e.com",
      query: "beta",
      max_tokens: 50,
    });
    expect(r.markdown).toContain("beta");
  });
  it("rejects bad url/tokens and surfaces HTTP errors", async () => {
    const cache = new MemoryDocsCache();
    await expect(fetchDocs(async () => ({ status: 200, text: "x" }), cache, { url: "ftp://x" })).rejects.toThrow(
      ToolError,
    );
    await expect(fetchDocs(async () => ({ status: 404, text: "no" }), cache, { url: "https://e.com" })).rejects.toThrow(
      ToolError,
    );
    await expect(
      fetchDocs(async () => ({ status: 200, text: "" }), cache, { url: "https://e.com" }),
    ).rejects.toThrow(ToolError);
  });
  it("issues a doc_id when a registry is supplied; omits it otherwise", async () => {
    const cache = new MemoryDocsCache();
    const seen = new Map<string, string>();
    const registry = {
      register: (source: string, markdown: string) => {
        const id = `doc:${source}-${markdown.length}`;
        seen.set(id, markdown);
        return id;
      },
    };
    const withReg = await fetchDocs(async () => ({ status: 200, text: "# T\nbody" }), cache, { url: "https://e.com/d" }, registry);
    expect(withReg.doc_id).toContain("doc:");
    const withoutReg = await fetchDocs(async () => ({ status: 200, text: "# T\nbody" }), new MemoryDocsCache(), { url: "https://e.com/d" });
    expect(withoutReg.doc_id).toBeUndefined();
  });
});
