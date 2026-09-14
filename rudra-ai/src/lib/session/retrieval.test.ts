import { describe, expect, it } from "vitest";
import { DEFAULT_TOP_K, clampTopK, planRetrieval, shouldFetch } from "./retrieval";

describe("clampTopK", () => {
  it("defaults to 3, clamps 1..10", () => {
    expect(clampTopK(undefined)).toBe(DEFAULT_TOP_K);
    expect(clampTopK(NaN)).toBe(DEFAULT_TOP_K);
    expect(clampTopK(0)).toBe(1);
    expect(clampTopK(99)).toBe(10);
    expect(clampTopK(5)).toBe(5);
  });
});

describe("planRetrieval", () => {
  it("orders map → symbols, carries topK", () => {
    const steps = planRetrieval({ goal: "fix auth", focus: ["src/api/**"], queries: ["getUser", "verifyToken"] });
    expect(steps[0]).toMatchObject({ tool: "repo_map" });
    expect(steps).toHaveLength(3);
    expect(steps[1]?.args).toMatchObject({ query: "getUser", topK: 3 });
  });
  it("skips queries for files already held", () => {
    const steps = planRetrieval({ goal: "x", queries: ["src/api.ts", "getUser"], knownRefs: ["src/api.ts@a3f9"] });
    expect(steps.map((s) => s.tool)).toEqual(["repo_map", "search_symbols"]);
    expect(steps[1]?.args["query"]).toBe("getUser");
  });
  it("caps queries at 5 and rejects empty goals", () => {
    const steps = planRetrieval({ goal: "x", queries: ["a", "b", "c", "d", "e", "f", "g"] });
    expect(steps).toHaveLength(6);
    expect(() => planRetrieval({ goal: "  " })).toThrow();
  });
});

describe("shouldFetch", () => {
  const base = { url: "https://x.com/d", knownDocIds: [] as string[], failedUrls: [] as string[], fetchedUrls: [] as string[] };
  it("fetches unknown urls", () => {
    expect(shouldFetch(base).fetch).toBe(true);
  });
  it("skips fetched, failed, and empty urls", () => {
    expect(shouldFetch({ ...base, fetchedUrls: [base.url] })).toMatchObject({ fetch: false });
    expect(shouldFetch({ ...base, failedUrls: [base.url] })).toMatchObject({ fetch: false });
    expect(shouldFetch({ ...base, url: "  " }).fetch).toBe(false);
  });
});
