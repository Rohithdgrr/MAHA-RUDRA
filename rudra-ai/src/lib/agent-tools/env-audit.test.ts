import { describe, expect, it } from "vitest";
import { envAudit, parseDotEnv, scanEnvRefs } from "./env-audit";
import { ToolError } from "./types";

describe("envAudit", () => {
  it("scans TS + Rust + Python refs", () => {
    const refs = scanEnvRefs([
      { path: "a.ts", content: "process.env.DB_URL; import.meta.env.VITE_K;" },
      { path: "b.rs", content: `std::env::var("RUST_K")` },
    ]);
    expect(refs).toContain("DB_URL");
    expect(refs).toContain("VITE_K");
    expect(refs).toContain("RUST_K");
  });
  it("parses .env quotes/exports/comments", () => {
    const p = parseDotEnv(`# c\nexport A=1\nB="x y"\nC='z'\nBAD-KEY=1\nD=1 # trailing\n`);
    expect(p).toMatchObject({ A: "1", B: "x y", C: "z", D: "1" });
  });
  it("reports missing vs present + invalid ports", async () => {
    const r = await envAudit({
      required: ["A", "MISSING", "PORT_X"],
      processEnv: { A: "1", PORT_X: "abc" },
    });
    expect(r.present).toContain("A");
    expect(r.missing).toContain("MISSING");
    expect(r.invalid.some((x) => x.key === "PORT_X")).toBe(true);
  });
  it("connectivity pings URL-shaped values only", async () => {
    const seen: string[] = [];
    const r = await envAudit(
      { required: ["API_URL", "PLAIN"], processEnv: { API_URL: "https://x", PLAIN: "v" }, check_connectivity: true },
      async (k) => {
        seen.push(k);
        return { ok: true };
      },
    );
    expect(seen).toEqual(["API_URL"]);
    expect(r.connectivity?.[0]).toMatchObject({ key: "API_URL", ok: true });
  });
  it("connectivity without pinger errors", async () => {
    await expect(envAudit({ required: ["A"], processEnv: { A: "1" }, check_connectivity: true })).rejects.toThrow(
      ToolError,
    );
  });
});
