/** parallel_subagents: fan-out for independent search/read work. Edits forbidden. */
import { ToolError, clamp } from "./types";

export interface SubTask {
  id: string;
  goal: string;
  tools?: string[];
  budget_tokens?: number;
  timeout_ms?: number;
}

export interface ParallelInput {
  tasks: SubTask[];
  max_concurrency?: number;
  merge?: "concat" | "synthesize" | "first_success";
}

export interface SubResult {
  id: string;
  status: "ok" | "error" | "timeout";
  output?: string;
  error?: string;
  tokens_used?: number;
  duration_ms: number;
}

export interface ParallelResult {
  results: SubResult[];
  merged: string;
}

export type SubagentFn = (task: SubTask) => Promise<{ output: string; tokens_used?: number }>;

const EDIT_TOOLS = ["batch_edit", "checkpoint", "restore", "write_file", "apply_patch"];
const MAX_OUTPUT = 8000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([p.finally(() => {
    if (timer) clearTimeout(timer);
  }), timeout]);
}

export async function parallelSubagents(
  runOne: SubagentFn,
  input: ParallelInput,
): Promise<ParallelResult> {
  if (!Array.isArray(input.tasks) || input.tasks.length === 0)
    throw new ToolError("BAD_INPUT", "tasks must be a non-empty array");
  if (input.tasks.length > 16) throw new ToolError("BAD_INPUT", "too many tasks (max 16)");
  const ids = new Set<string>();
  for (const t of input.tasks) {
    if (!t.id?.trim() || !t.goal?.trim()) throw new ToolError("BAD_INPUT", "each task needs id + goal");
    if (ids.has(t.id)) throw new ToolError("BAD_INPUT", `duplicate task id: ${t.id}`);
    ids.add(t.id);
    if (t.tools?.some((x) => EDIT_TOOLS.includes(x)))
      throw new ToolError(
        "POLICY_DENIED",
        `task ${t.id} requests edit tools; parallel fan-out is for search/read only`,
      );
  }
  const maxC = clamp(Math.round(input.max_concurrency ?? 4), 1, 8);
  const merge = input.merge ?? "concat";
  const results: SubResult[] = new Array(input.tasks.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const idx = cursor++;
      if (idx >= input.tasks.length) return;
      const task = input.tasks[idx];
      if (!task) return;
      const timeout = clamp(task.timeout_ms ?? 60000, 10, 300000);
      const start = Date.now();
      try {
        const r = await withTimeout(runOne(task), timeout);
        const output = (r.output ?? "").slice(0, MAX_OUTPUT);
        results[idx] = {
          id: task.id,
          status: "ok",
          output,
          tokens_used: r.tokens_used,
          duration_ms: Date.now() - start,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const isTimeout = /timed?\s*out/i.test(msg);
        results[idx] = {
          id: task.id,
          status: isTimeout ? "timeout" : "error",
          error: msg.slice(0, 1000),
          duration_ms: Date.now() - start,
        };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(maxC, input.tasks.length) }, () => worker()));

  const finalResults = results.map((r, i) => r ?? {
    id: input.tasks[i]?.id ?? `t${i}`,
    status: "error" as const,
    error: "not executed",
    duration_ms: 0,
  });
  let merged = "";
  if (merge === "first_success") {
    merged = finalResults.find((r) => r.status === "ok")?.output ?? "";
  } else if (merge === "synthesize") {
    // deterministic dedupe join (no LLM): header per task, skip failures
    merged = finalResults
      .filter((r) => r.status === "ok" && r.output)
      .map((r) => `## ${r.id}\n${r.output}`)
      .join("\n\n");
  } else {
    merged = finalResults.map((r) => `## ${r.id} [${r.status}]\n${r.output ?? r.error ?? ""}`).join("\n\n");
  }
  return { results: finalResults, merged: merged.slice(0, MAX_OUTPUT * 2) };
}
