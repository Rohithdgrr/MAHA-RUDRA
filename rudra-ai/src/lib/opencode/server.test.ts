import { describe, expect, it } from "vitest";
import { isLoopbackHost, isVersionAtLeast, validateServerUrl } from "./server";

describe("isVersionAtLeast", () => {
  it("compares semver segments", () => {
    expect(isVersionAtLeast("1.0.216")).toBe(true);
    expect(isVersionAtLeast("1.0.217")).toBe(true);
    expect(isVersionAtLeast("1.1.0")).toBe(true);
    expect(isVersionAtLeast("2.0.0")).toBe(true);
    expect(isVersionAtLeast("1.0.215")).toBe(false);
    expect(isVersionAtLeast("0.9.9")).toBe(false);
  });

  it("treats unknown versions as below floor", () => {
    expect(isVersionAtLeast(undefined)).toBe(false);
    expect(isVersionAtLeast("")).toBe(false);
    expect(isVersionAtLeast("unknown")).toBe(false);
  });

  it("tolerates v-prefixes", () => {
    expect(isVersionAtLeast("v1.0.216")).toBe(true);
  });
});

describe("validateServerUrl", () => {
  it("accepts loopback http(s)", () => {
    expect(validateServerUrl("http://localhost:4096")).toEqual({
      ok: true,
      url: "http://localhost:4096",
      remote: false,
    });
    expect(validateServerUrl("http://127.0.0.1:4096/")).toMatchObject({ ok: true, remote: false });
  });

  it("flags remote hosts without blocking", () => {
    expect(validateServerUrl("http://192.168.1.10:4096")).toMatchObject({ ok: true, remote: true });
    expect(validateServerUrl("https://agent.example.com")).toMatchObject({ ok: true, remote: true });
  });

  it("rejects garbage", () => {
    expect(validateServerUrl("").ok).toBe(false);
    expect(validateServerUrl("not-a-url").ok).toBe(false);
    expect(validateServerUrl("ftp://host/x").ok).toBe(false);
  });
});

describe("isLoopbackHost", () => {
  it("covers localhost forms and 127/8", () => {
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("[::1]")).toBe(true);
    expect(isLoopbackHost("example.com")).toBe(false);
  });
});
