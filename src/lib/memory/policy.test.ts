import { describe, expect, it } from "vitest";
import { isSuppressed, routeCandidate, suppressKey } from "./policy";

describe("routeCandidate", () => {
  it("auto-saves high-confidence non-sensitive facts", () => {
    expect(routeCandidate(0.9, false)).toBe("auto");
    expect(routeCandidate(0.8, false)).toBe("auto");
  });

  it("reviews mid-confidence or sensitive facts", () => {
    expect(routeCandidate(0.6, false)).toBe("review");
    expect(routeCandidate(1, true)).toBe("review");
    expect(routeCandidate(0.9, true)).toBe("review");
  });

  it("drops low-confidence facts", () => {
    expect(routeCandidate(0.3, false)).toBe("drop");
    expect(routeCandidate(0.2, true)).toBe("drop");
  });
});

describe("suppression", () => {
  it("suppresses and expires", () => {
    window.localStorage.clear();
    expect(isSuppressed("github")).toBe(false);
    suppressKey("github");
    expect(isSuppressed("github")).toBe(true);
    expect(isSuppressed("github", Date.now() + 25 * 60 * 60 * 1000)).toBe(false);
  });
});
