import { beforeEach, describe, expect, it } from "vitest";
import { buildBasicAuthHeader, getServerUrl, isTauri, setServerUrl } from "./env";

describe("env", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("detects non-Tauri browser by default", () => {
    expect(isTauri()).toBe(false);
  });

  it("returns the default server URL when nothing is stored", () => {
    expect(getServerUrl()).toBe("http://localhost:4096");
  });

  it("round-trips a custom server URL through localStorage", () => {
    setServerUrl("http://example:8080");
    expect(getServerUrl()).toBe("http://example:8080");
  });

  it("builds a Basic auth header", () => {
    expect(buildBasicAuthHeader("opencode", "secret")).toBe(`Basic ${btoa("opencode:secret")}`);
  });
});
