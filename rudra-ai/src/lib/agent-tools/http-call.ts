/** http_call: structured HTTP with expect verdict + secret redaction. */
import { ToolError, clamp, tailLines } from "./types";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpExpect {
  status?: number;
  json_path?: string;
  json_equals?: unknown;
}

export interface HttpInput {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  auth?: string;
  expect?: HttpExpect;
  timeout_ms?: number;
}

export interface HttpResult {
  passed: boolean;
  status: number;
  headers: Record<string, string>;
  body: unknown;
  duration_ms: number;
  matched: boolean;
}

export type HttpFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal: AbortSignal },
) => Promise<{ status: number; headers: Record<string, string>; text: string }>;

function getJsonPath(obj: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur !== null && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else return undefined;
  }
  return cur;
}

function deepEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function redactHeaders(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    out[k] = /auth|token|secret|cookie|api[-_]?key/i.test(k) ? "[redacted]" : v;
  }
  return out;
}

export async function httpCall(
  fetchFn: HttpFetch | undefined,
  secrets: Record<string, string>,
  input: HttpInput,
): Promise<HttpResult> {
  if (!fetchFn) throw new ToolError("TOOL_UNAVAILABLE", "no HTTP transport available");
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(input.method))
    throw new ToolError("BAD_INPUT", "invalid method");
  if (!/^https?:\/\//i.test((input.url ?? "").trim()))
    throw new ToolError("BAD_INPUT", "url must be http(s)");
  const timeoutMs = clamp(input.timeout_ms ?? 30000, 1000, 120000);
  const headers: Record<string, string> = { ...(input.headers ?? {}) };
  if (input.auth) {
    const token = secrets[input.auth];
    if (!token) throw new ToolError("NOT_FOUND", `unknown auth secret: ${input.auth}`);
    headers["Authorization"] = `Bearer ${token}`;
  }
  let bodyStr: string | undefined;
  if (input.body !== undefined) {
    bodyStr = typeof input.body === "string" ? input.body : JSON.stringify(input.body);
    if (bodyStr.length > 1_000_000) throw new ToolError("BAD_INPUT", "body too large");
    headers["Content-Type"] ??= "application/json";
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetchFn(input.url, { method: input.method, headers, body: bodyStr, signal: ctrl.signal });
    let body: unknown = tailLines(res.text, 500);
    const ct = res.headers["content-type"] ?? res.headers["Content-Type"] ?? "";
    if (/json/i.test(ct)) {
      try {
        body = JSON.parse(res.text) as unknown;
      } catch {
        body = tailLines(res.text, 500);
      }
    }
    let matched = true;
    if (input.expect?.status !== undefined && res.status !== input.expect.status) matched = false;
    if (matched && input.expect?.json_path !== undefined) {
      const v = getJsonPath(body, input.expect.json_path);
      if (input.expect.json_equals !== undefined) {
        if (!deepEqual(v, input.expect.json_equals)) matched = false;
      } else if (v === undefined) matched = false;
    } else if (matched && input.expect?.json_equals !== undefined) {
      if (!deepEqual(body, input.expect.json_equals)) matched = false;
    }
    const passed = input.expect?.status !== undefined ? res.status === input.expect.status && matched : res.status >= 200 && res.status < 300 && matched;
    return {
      passed,
      status: res.status,
      headers: redactHeaders(res.headers),
      body,
      duration_ms: Date.now() - start,
      matched,
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ToolError("TIMEOUT", `request timed out after ${timeoutMs}ms`);
    }
    if (e instanceof ToolError) throw e;
    throw new ToolError("EXEC_FAILED", `request failed: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    clearTimeout(timer);
  }
}
