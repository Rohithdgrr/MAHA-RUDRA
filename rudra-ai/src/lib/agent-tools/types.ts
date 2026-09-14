/** Shared envelopes + errors for all agent tools. Pure, no DOM deps. */

export type ToolCode =
  | "OK"
  | "BAD_INPUT"
  | "NOT_FOUND"
  | "TOOL_UNAVAILABLE"
  | "EXEC_FAILED"
  | "TIMEOUT"
  | "CONFLICT"
  | "POLICY_DENIED";

export interface ToolErrorJson {
  code: ToolCode;
  message: string;
  details?: string;
}

export class ToolError extends Error {
  readonly code: ToolCode;
  readonly details?: string;
  constructor(code: ToolCode, message: string, details?: string) {
    super(message);
    this.name = "ToolError";
    this.code = code;
    this.details = details;
  }
  toJSON(): ToolErrorJson {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ToolErrorJson };

export function ok<T>(data: T): ToolResult<T> {
  return { ok: true, data };
}

export function err<T>(code: ToolCode, message: string, details?: string): ToolResult<T> {
  return { ok: false, error: { code, message, details } };
}

/** Last N lines of text (for log tails). Pure. */
export function tailLines(text: string, maxLines = 200): string {
  if (maxLines <= 0) return "";
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return lines.slice(lines.length - maxLines).join("\n");
}

/** Clamp a number into [min,max]. Pure. */
export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Rough token estimate (~4 chars/token). Pure. */
export function estimateTokens(text: string): number {
  const len = text.trim().length;
  if (len === 0) return 0;
  return Math.max(1, Math.ceil(len / 4));
}

/** Truncate text to roughly maxTokens. Pure. */
export function truncateToTokens(text: string, maxTokens: number): string {
  if (maxTokens <= 0) return "";
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n…[truncated]";
}

/** Minimal djb2-style hash for cache keys. Pure. */
export function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };
