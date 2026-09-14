/** db_schema + db_query: introspection and safe queries. Connections by name only. */
import { ToolError, clamp } from "./types";

export type DbInclude = "columns" | "indexes" | "fks" | "constraints" | "row_counts";
export type DbMode = "read_only" | "explain" | "transaction";

export interface DbSchemaInput {
  connection: string;
  tables?: string[];
  include?: DbInclude[];
}

export interface DbQueryInput {
  connection: string;
  sql: string;
  mode?: DbMode;
  max_rows?: number;
  commit?: boolean;
}

export interface DbDriver {
  schema(connection: string, tables?: string[], include?: DbInclude[]): Promise<unknown>;
  query(
    connection: string,
    sql: string,
    opts: { mode: DbMode; maxRows: number },
  ): Promise<{ rows: Array<Record<string, unknown>>; plan?: string; warnings?: string[] }>;
}

const WRITE_RE = /\b(insert|update|delete|create|drop|alter|truncate|grant|revoke)\b/i;

export function isWriteSql(sql: string): boolean {
  const s = sql.trim().replace(/^\(+/, "");
  if (/^(select|with|explain|show|describe|desc)\b/i.test(s)) return false;
  return WRITE_RE.test(s);
}

export function validateConnectionName(name: string, known: string[]): string {
  const n = (name ?? "").trim();
  if (!n) throw new ToolError("BAD_INPUT", "connection is required");
  if (/[:/\\@]/.test(n) || n.includes("://"))
    throw new ToolError("BAD_INPUT", "pass a configured connection name, never a URL or DSN");
  if (known.length > 0 && !known.includes(n))
    throw new ToolError("NOT_FOUND", `unknown connection: ${n}`);
  return n;
}

export async function dbSchema(
  driver: DbDriver | undefined,
  knownConnections: string[],
  input: DbSchemaInput,
): Promise<{ schema: unknown; connection: string }> {
  if (!driver) throw new ToolError("TOOL_UNAVAILABLE", "no database configured for this workspace");
  const conn = validateConnectionName(input.connection, knownConnections);
  if (input.tables && input.tables.length > 100) throw new ToolError("BAD_INPUT", "too many tables");
  try {
    const schema = await driver.schema(conn, input.tables, input.include);
    return { schema, connection: conn };
  } catch (e) {
    throw new ToolError("EXEC_FAILED", `schema introspection failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function dbQuery(
  driver: DbDriver | undefined,
  knownConnections: string[],
  input: DbQueryInput,
): Promise<{ rows: Array<Record<string, unknown>>; plan?: string; warnings: string[]; rolledBack: boolean }> {
  if (!driver) throw new ToolError("TOOL_UNAVAILABLE", "no database configured for this workspace");
  const conn = validateConnectionName(input.connection, knownConnections);
  const sql = (input.sql ?? "").trim();
  if (!sql) throw new ToolError("BAD_INPUT", "sql must be non-empty");
  if (sql.length > 50_000) throw new ToolError("BAD_INPUT", "sql too long");
  const mode = input.mode ?? "read_only";
  const maxRows = clamp(Math.round(input.max_rows ?? 100), 1, 1000);
  if (mode === "read_only" && isWriteSql(sql))
    throw new ToolError("POLICY_DENIED", "write SQL requires mode transaction + explicit commit");
  if (mode === "transaction" && isWriteSql(sql) && !input.commit) {
    // auto-rollback path: allowed to run, results flagged
  }
  try {
    const r = await driver.query(conn, sql, { mode, maxRows });
    const rows = r.rows.slice(0, maxRows);
    const warnings = [...(r.warnings ?? [])];
    if (r.plan && /seq\s*scan|full\s*scan|filesort/i.test(r.plan)) {
      if (!warnings.some((w) => /scan/i.test(w))) warnings.push("query plan shows full scan; needs index");
    }
    return { rows, plan: r.plan, warnings, rolledBack: mode === "transaction" && !input.commit };
  } catch (e) {
    throw new ToolError("EXEC_FAILED", `query failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
