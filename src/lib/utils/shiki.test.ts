import { describe, expect, it } from "vitest";
import { highlightWithShiki, pickShikiLang } from "./shiki";

describe("pickShikiLang", () => {
  it("maps aliases to bundled grammars", () => {
    expect(pickShikiLang("ts")).toBe("typescript");
    expect(pickShikiLang("py")).toBe("python");
    expect(pickShikiLang("sh")).toBe("bash");
    expect(pickShikiLang("rust")).toBe("rust");
  });

  it("returns undefined for unknown languages", () => {
    expect(pickShikiLang("")).toBeUndefined();
    expect(pickShikiLang("brainfuck")).toBeUndefined();
  });
});

describe("highlightWithShiki", () => {
  it("falls back gracefully before init", () => {
    expect(highlightWithShiki("const x = 1;", "ts")).toBeUndefined();
  });
});
