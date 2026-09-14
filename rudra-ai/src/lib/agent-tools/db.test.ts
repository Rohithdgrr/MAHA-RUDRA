import { describe, expect, it } from "vitest";
import { dbQuery, dbSchema, isWriteSql } from "./db";
import { ToolError } from "./types";

const driver = {
  schema: async () => ({ tables: ["users"] }),
  query: async (_c: string, sql: string, _o: { mode: string; maxRows: number }) => ({
    rows: [{ a: 1 }],
    plan: sql.includes("SCAN") ? "Seq Scan on users" : "Index Scan",
    warnings: [] as string[],
  }),
};

describe("db tools", () => {
  it("isWriteSql classifies correctly", () => {
    expect(isWriteSql("SELECT 1")).toBe(false);
    expect(isWriteSql("WITH x AS (SELECT 1) SELECT * FROM x")).toBe(false);
    expect(isWriteSql("DELETE FROM t")).toBe(true);
    expect(isWriteSql("UPDATE t SET a=1")).toBe(true);
  });
  it("schema resolves named connection", async () => {
    const r = await dbSchema(driver, ["app"], { connection: "app" });
    expect(r.connection).toBe("app");
    await expect(dbSchema(driver, ["app"], { connection: "other" })).rejects.toThrow(ToolError);
    await expect(dbSchema(driver, ["app"], { connection: "postgres://x" })).rejects.toThrow(ToolError);
    await expect(dbSchema(undefined, ["app"], { connection: "app" })).rejects.toThrow(ToolError);
  });
  it("read_only blocks writes", async () => {
    await expect(dbQuery(driver, ["app"], { connection: "app", sql: "DROP TABLE t" })).rejects.toThrow(ToolError);
    const r = await dbQuery(driver, ["app"], { connection: "app", sql: "SELECT 1" });
    expect(r.rows).toHaveLength(1);
    expect(r.rolledBack).toBe(false);
  });
  it("transaction without commit flags rolledBack; full scan warns", async () => {
    const r = await dbQuery(driver, ["app"], {
      connection: "app",
      sql: "SELECT * FROM users SCAN",
      mode: "transaction",
    });
    expect(r.rolledBack).toBe(true);
    expect(r.warnings.some((w) => /scan/i.test(w))).toBe(true);
  });
  it("clamps max_rows and validates sql", async () => {
    const r = await dbQuery(driver, ["app"], { connection: "app", sql: "SELECT 1", max_rows: 9999 });
    expect(r.rows.length).toBeLessThanOrEqual(1000);
    await expect(dbQuery(driver, ["app"], { connection: "app", sql: "  " })).rejects.toThrow(ToolError);
  });
});
