import { describe, expect, it } from "vitest";
import { apiSchema, extractTauriCommands } from "./api-schema";
import { ToolError } from "./types";

describe("apiSchema", () => {
  it("parses OpenAPI with $ref + operation filter", async () => {
    const spec = JSON.stringify({
      openapi: "3.0.0",
      paths: { "/u": { get: { summary: "list", responses: { "200": { description: "ok" } } } } },
      components: { schemas: { User: { properties: { id: {}, name: {} } } } },
    });
    const r = await apiSchema({ source: "file", spec });
    expect(r.kind).toBe("openapi");
    expect(r.operations[0]?.name).toBe("GET /u");
    expect(r.types[0]).toMatchObject({ name: "User" });
    const filtered = await apiSchema({ source: "file", spec, operation: "nope" });
    expect(filtered.operations).toEqual([]);
  });
  it("parses GraphQL + proto", async () => {
    const g = await apiSchema({ source: "file", spec: "type Query { user: User }\ntype User { id: ID }" });
    expect(g.kind).toBe("graphql");
    const p = await apiSchema({
      source: "file",
      spec: 'syntax = "proto3";\nmessage U { string id = 1; }\nservice S { rpc Get (U) returns (U); }',
    });
    expect(p.kind).toBe("proto");
    expect(p.operations[0]?.name).toBe("S.Get");
  });
  it("extracts Tauri commands from rs + ts", () => {
    const cmds = extractTauriCommands([
      { path: "src-tauri/src/lib.rs", content: '#[tauri::command]\nfn greet(name: String) -> String { name }' },
      { path: "src/app.ts", content: 'invoke("greet", { name: "x" })' },
    ]);
    expect(cmds.map((c) => c.name)).toContain("greet");
  });
  it("rejects empty/oversized/invalid specs", async () => {
    await expect(apiSchema({ source: "file", spec: "" })).rejects.toThrow(ToolError);
    await expect(apiSchema({ source: "file", spec: "{not json" })).rejects.toThrow(ToolError);
  });
});
