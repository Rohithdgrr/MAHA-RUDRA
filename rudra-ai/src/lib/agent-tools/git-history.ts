/** git_history: blame/log/diff/pr_context/bisect with injected runner. */
import { ToolError, clamp } from "./types";

export type GitOp = "blame" | "log" | "diff_between" | "pr_context" | "bisect";

export interface GitHistoryInput {
  op: GitOp;
  file?: string;
  line_start?: number;
  line_end?: number;
  since?: string;
  path?: string;
  base?: string;
  head?: string;
  pr?: number;
  failingCommand?: string;
}

export interface BlameLine {
  line: number;
  commit: string;
  author: string;
  date: string;
  message: string;
}

export interface GitRunner {
  exec(args: string[]): Promise<string>;
  gh(args: string[]): Promise<string>;
}

function need(runner: GitRunner | undefined): GitRunner {
  if (!runner) throw new ToolError("TOOL_UNAVAILABLE", "not a git repo or git unavailable");
  return runner;
}

/** Parse `git blame --porcelain` into lines. Tolerant fallback included. */
export function parseBlamePorcelain(out: string): BlameLine[] {
  const lines = out.split("\n");
  const result: BlameLine[] = [];
  let cur = { commit: "", author: "", date: "", message: "" };
  let lineNo = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] ?? "";
    const commitM = l.match(/^([0-9a-f]{5,40})\s+\d+\s+(\d+)/);
    if (commitM) {
      cur = { commit: commitM[1] ?? "", author: cur.author, date: cur.date, message: cur.message };
      continue;
    }
    if (l.startsWith("author ")) cur.author = l.slice(7).slice(0, 80);
    else if (l.startsWith("author-time ")) {
      const t = parseInt(l.slice(12).trim(), 10);
      cur.date = Number.isFinite(t) ? new Date(t * 1000).toISOString() : "";
    } else if (l.startsWith("summary ")) cur.message = l.slice(8).slice(0, 200);
    else if (l.startsWith("\t")) {
      lineNo++;
      result.push({ line: lineNo, commit: cur.commit, author: cur.author, date: cur.date, message: cur.message });
    }
  }
  return result;
}

export interface GitHistoryResult {
  op: GitOp;
  blame?: BlameLine[];
  log?: Array<{ hash: string; author: string; date: string; message: string }>;
  diff?: string;
  pr?: { title: string; body: string; comments: string[] };
  bisect?: { culprit: string; steps: number };
}

export async function gitHistory(
  runner: GitRunner | undefined,
  input: GitHistoryInput,
): Promise<GitHistoryResult> {
  const r = need(runner);
  switch (input.op) {
    case "blame": {
      if (!input.file) throw new ToolError("BAD_INPUT", "blame requires file");
      const ls = input.line_start ?? 1;
      const le = input.line_end ?? ls;
      if (!Number.isInteger(ls) || !Number.isInteger(le) || ls < 1 || le < ls)
        throw new ToolError("BAD_INPUT", "invalid line range");
      let out: string;
      try {
        out = await r.exec(["blame", "--porcelain", "-L", `${ls},${le}`, "--", input.file]);
      } catch (e) {
        throw new ToolError("EXEC_FAILED", `git blame failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      const all = parseBlamePorcelain(out);
      return { op: "blame", blame: all };
    }
    case "log": {
      const limit = 50;
      const args = ["log", "--follow", `--max-count=${limit}`, "--pretty=format:%H%x1f%an%x1f%ad%x1f%s", "--date=iso"];
      if (input.since) args.push(`--since=${input.since}`);
      if (input.file ?? input.path) args.push("--", (input.file ?? input.path) as string);
      let out: string;
      try {
        out = await r.exec(args);
      } catch (e) {
        throw new ToolError("EXEC_FAILED", `git log failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      const log = out
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => {
          const [hash = "", author = "", date = "", message = ""] = l.split("\x1f");
          return { hash, author, date, message };
        })
        .slice(0, limit);
      return { op: "log", log };
    }
    case "diff_between": {
      if (!input.base || !input.head) throw new ToolError("BAD_INPUT", "diff_between requires base + head");
      try {
        const diff = await r.exec(["diff", "--stat", `${input.base}...${input.head}`]);
        const full = await r.exec(["diff", `${input.base}...${input.head}`]).catch(() => diff);
        return { op: "diff_between", diff: full.slice(0, 100_000) };
      } catch (e) {
        throw new ToolError("EXEC_FAILED", `git diff failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    case "pr_context": {
      if (!input.pr || !Number.isInteger(input.pr))
        throw new ToolError("BAD_INPUT", "pr_context requires pr number");
      try {
        const raw = await r.gh(["pr", "view", String(input.pr), "--json", "title,body,comments"]);
        const j = JSON.parse(raw) as { title?: string; body?: string; comments?: Array<{ body?: string }> };
        return {
          op: "pr_context",
          pr: {
            title: String(j.title ?? "").slice(0, 300),
            body: String(j.body ?? "").slice(0, 8000),
            comments: (j.comments ?? []).map((c) => String(c.body ?? "").slice(0, 2000)).slice(0, 20),
          },
        };
      } catch (e) {
        throw new ToolError("EXEC_FAILED", `gh pr view failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    case "bisect": {
      if (!input.failingCommand) throw new ToolError("BAD_INPUT", "bisect requires failingCommand");
      const steps = clamp(20, 1, 50);
      void steps;
      // orchestrated bisect is intentionally conservative: report guidance, don't mutate user repo here
      throw new ToolError(
        "TOOL_UNAVAILABLE",
        "automated bisect is disabled in-app; run `git bisect run <cmd>` server-side instead",
      );
    }
  }
}
