import { describe, expect, it } from "vitest";
import { httpCall, redactHeaders } from "./http-call";
import { ToolError } from "./types";

const okFetch = async () => ({ status: 200, headers: { "content-type": "application/json", "x-a": "b" }, text: `{"ok":true,"n":1}` });

describe("httpCall", () => {
  it("returns parsed json + passed on 2xx", async () => {
    const r = await httpCall(okFetch, {}, { method: "GET", url: "https://api/x" });
    expect(r.passed).toBe(true);
    expect(r.body).toMatchObject({ ok: true });
  });
  it("expect.status/json_path/json_equals verdicts", async () => {
    const r = await httpCall(okFetch, {}, {
      method: "GET",
      url: "https://api/x",
      expect: { status: 200, json_path: "ok", json_equals: true },
    });
    expect(r.matched).toBe(true);
    const bad = await httpCall(okFetch, {}, {
      method: "GET",
      url: "https://api/x",
      expect: { status: 404 },
    });
    expect(bad.passed).toBe(false);
    const miss = await httpCall(okFetch, {}, {
      method: "GET",
      url: "https://api/x",
      expect: { json_path: "missing" },
    });
    expect(miss.matched).toBe(false);
  });
  it("injects named auth, redacts echo", async () => {
    let seen = "";
    const r = await httpCall(
      async (_u, init) => {
        seen = init.headers["Authorization"] ?? "";
        return { status: 200, headers: {}, text: "{}" };
      },
      { api: "tok123" },
      { method: "GET", url: "https://api/x", auth: "api" },
    );
    expect(seen).toContain("tok123");
    expect(r.headers).toEqual({});
    await expect(httpCall(okFetch, {}, { method: "GET", url: "https://api/x", auth: "nope" })).rejects.toThrow(
      ToolError,
    );
  });
  it("validates method/url/body; redacts sensitive headers", async () => {
    await expect(httpCall(okFetch, {}, { method: "GET", url: "ftp://x" })).rejects.toThrow(ToolError);
    await expect(httpCall(undefined, {}, { method: "GET", url: "https://x" })).rejects.toThrow(ToolError);
    expect(redactHeaders({ Authorization: "b", "x-a": "b" })).toMatchObject({ Authorization: "[redacted]" });
  });
});
