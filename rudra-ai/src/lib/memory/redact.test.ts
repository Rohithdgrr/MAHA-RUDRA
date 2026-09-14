import { describe, expect, it } from "vitest";
import { isSensitive, redactCheck } from "./redact";

describe("redactCheck", () => {
  it("passes plain facts", () => {
    expect(redactCheck("prefers Rust + axum").blocked).toBe(false);
    expect(redactCheck({ name: "Rohith" }).blocked).toBe(false);
  });

  it("blocks api keys and tokens", () => {
    expect(redactCheck("sk-ant-abcdefgh12345678").blocked).toBe(true);
    expect(redactCheck("ghp_abcdefghij1234567890").blocked).toBe(true);
    expect(redactCheck("AKIAIOSFODNN7EXAMPLE").blocked).toBe(true);
  });

  it("blocks passwords and private keys", () => {
    expect(redactCheck("password: hunter2-hunter2").blocked).toBe(true);
    expect(redactCheck("-----BEGIN PRIVATE KEY-----").blocked).toBe(true);
  });

  it("blocks card-shaped numbers and coordinates", () => {
    expect(redactCheck("4111 1111 1111 1111").blocked).toBe(true);
    expect(redactCheck("12.97160, 77.59460").blocked).toBe(true);
  });
});

describe("isSensitive", () => {
  it("marks contact and identity-adjacent keys", () => {
    expect(isSensitive("contact", "email")).toBe(true);
    expect(isSensitive("identity", "email")).toBe(true);
    expect(isSensitive("identity", "phone")).toBe(true);
    expect(isSensitive("preferences", "editor")).toBe(false);
  });
});
