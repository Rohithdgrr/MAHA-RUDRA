import { describe, expect, it } from "vitest";
import { consumeTurnElapsed, isDesktop, notePromptSent, parseOpenTarget } from "./desktop";

describe("parseOpenTarget", () => {
  it("parses session deep links", () => {
    expect(parseOpenTarget("rudra://session/ses_abc")).toEqual({ kind: "session", id: "ses_abc" });
  });

  it("parses open-with-path deep links", () => {
    expect(parseOpenTarget("rudra://open?path=C%3A%5Cproj")).toEqual({
      kind: "path",
      path: "C:\\proj",
    });
  });

  it("rejects unknown schemes and hosts", () => {
    expect(parseOpenTarget("rudra://bogus/x")).toBeUndefined();
    expect(parseOpenTarget("https://example.com/s/1")).toBeUndefined();
    expect(parseOpenTarget("rudra://open")).toBeUndefined();
  });

  it("passes raw folder paths through and rejects empties", () => {
    expect(parseOpenTarget("C:\\Users\\rohit\\proj")).toEqual({
      kind: "path",
      path: "C:\\Users\\rohit\\proj",
    });
    expect(parseOpenTarget("")).toBeUndefined();
    expect(parseOpenTarget(null)).toBeUndefined();
    expect(parseOpenTarget("   ")).toBeUndefined();
  });
});

describe("turn timing", () => {
  it("measures elapsed ms once, then forgets", () => {
    notePromptSent("s1");
    const elapsed = consumeTurnElapsed("s1");
    expect(typeof elapsed).toBe("number");
    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(consumeTurnElapsed("s1")).toBeUndefined();
  });

  it("returns undefined for unknown sessions", () => {
    expect(consumeTurnElapsed("nope")).toBeUndefined();
  });
});

describe("web safety", () => {
  it("is not desktop under jsdom", () => {
    expect(isDesktop()).toBe(false);
  });
});
