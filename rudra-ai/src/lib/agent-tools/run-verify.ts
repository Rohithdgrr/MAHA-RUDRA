/** run_verify: structured command execution with expectations + policy blocklist. */
import { ToolError, clamp, tailLines } from "./types";

export interface RunVerifyExpect {
  exit_code?: number;
  stdout_contains?: string;
  stdout_matches?: string;
}

export interface RunVerifyInput {
  cmd: string;
  cwd?: string;
  timeout_ms?: number;
  expect?: RunVerifyExpect;
  stream?: boolean;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut?: boolean;
}

export interface CommandRunner {
  exec(cmd: string, opts?: { cwd?: string; timeoutMs?: number }): Promise<ExecResult>;
}

export interface RunVerifyResult {
  passed: boolean;
  exit_code: number;
  stdout_tail: string;
  stderr_tail: string;
  duration_ms: number;
  matched: boolean;
  timedOut: boolean;
}

const BLOCKED = [/^\s*git\s+push\b/i, /^\s*git\s+commit\b/i, /:\(\)\s*{\s*:\s*|\s*&\s*}\s*;?\s*:/];

export function isBlockedCommand(cmd: string): boolean {
  return BLOCKED.some((re) => re.test(cmd));
}

/** Streaming early-abort contract (Layer 10.5): a streaming runner feeds each
 *  output line through `matchAbortPatterns`; the first hit aborts the command
 *  instead of waiting minutes to report failure. Non-streaming runners ignore
 *  this — post-hoc scanning can't recover wasted time. Pure. */
export function matchAbortPatterns(line: string, patterns: string[]): string | undefined {
  for (const p of patterns) {
    const pat = p.trim();
    if (!pat) continue;
    try {
      if (new RegExp(pat).test(line)) return pat;
    } catch {
      if (line.includes(pat)) return pat;
    }
  }
  return undefined;
}

/** Default abort signatures: deterministic failures not worth waiting out. */
export const DEFAULT_ABORT_PATTERNS = [
  "error TS\\d+:",
  "FAILED \\(failures=",
  "npm ERR! ",
  "panic: ",
  "Traceback \\(most recent call last\\):",
  "out of memory",
  "Segmentation fault",
];

export async function runVerify(runner: CommandRunner | undefined, input: RunVerifyInput): Promise<RunVerifyResult> {
  if (!runner) throw new ToolError("TOOL_UNAVAILABLE", "no command runner (server-side only)");
  if (!input.cmd || !input.cmd.trim()) throw new ToolError("BAD_INPUT", "cmd must be non-empty");
  if (input.cmd.length > 8000) throw new ToolError("BAD_INPUT", "cmd too long");
  if (isBlockedCommand(input.cmd))
    throw new ToolError(
      "POLICY_DENIED",
      "git commit/push must use the explicit user-confirmed path, not run_verify",
    );
  const timeoutMs = clamp(input.timeout_ms ?? 60000, 1000, 600000);
  let raw: ExecResult;
  try {
    raw = await runner.exec(input.cmd, { cwd: input.cwd, timeoutMs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/timed?\s*out/i.test(msg)) {
      return {
        passed: false,
        exit_code: 124,
        stdout_tail: "",
        stderr_tail: tailLines(msg, 50),
        duration_ms: timeoutMs,
        matched: false,
        timedOut: true,
      };
    }
    throw new ToolError("EXEC_FAILED", `command failed to execute: ${msg}`);
  }
  const exp = input.expect ?? {};
  let matched = true;
  if (exp.exit_code !== undefined && raw.exitCode !== exp.exit_code) matched = false;
  else if (exp.exit_code === undefined && exp.stdout_contains === undefined && exp.stdout_matches === undefined) {
    matched = raw.exitCode === 0;
  }
  if (matched && exp.stdout_contains !== undefined && !raw.stdout.includes(exp.stdout_contains))
    matched = false;
  if (matched && exp.stdout_matches !== undefined) {
    try {
      if (!new RegExp(exp.stdout_matches).test(raw.stdout)) matched = false;
    } catch {
      throw new ToolError("BAD_INPUT", "stdout_matches is not a valid regex");
    }
  }
  const passed = raw.exitCode === (exp.exit_code ?? 0) && matched && !raw.timedOut;
  return {
    passed,
    exit_code: raw.exitCode,
    stdout_tail: tailLines(raw.stdout, 200),
    stderr_tail: tailLines(raw.stderr, 200),
    duration_ms: raw.durationMs,
    matched,
    timedOut: raw.timedOut ?? false,
  };
}
