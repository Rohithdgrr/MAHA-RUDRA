/** batch_edit: atomic multi-file edits with validation + unified-diff patch support. */
import { ToolError } from "./types";

export type EditOpType = "create" | "replace" | "patch" | "delete";

export interface EditOp {
  file: string;
  op: EditOpType;
  content?: string;
  patch?: string;
  old_string?: string;
  new_string?: string;
}

export interface BatchEditInput {
  edits: EditOp[];
  atomic?: boolean;
}

export interface FileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  delete(path: string): Promise<void>;
}

export interface PerFileStatus {
  file: string;
  op: EditOpType;
  applied: boolean;
  error?: string;
}

export interface BatchEditResult {
  results: PerFileStatus[];
  appliedAll: boolean;
  preimages: Record<string, string | null>;
}

function assertSafePath(file: string): void {
  if (!file || !file.trim()) throw new ToolError("BAD_INPUT", "edit file must be non-empty");
  const p = file.replace(/\\/g, "/");
  if (p.includes("\0")) throw new ToolError("BAD_INPUT", `invalid path: ${file}`);
  const parts = p.split("/");
  if (parts.includes("..")) throw new ToolError("BAD_INPUT", `path traversal denied: ${file}`);
  if (p.startsWith("/") || /^[A-Za-z]:\//.test(p))
    throw new ToolError("BAD_INPUT", `absolute paths denied: ${file}`);
}

function countOccurrences(hay: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let i = 0;
  for (;;) {
    const j = hay.indexOf(needle, i);
    if (j < 0) return count;
    count++;
    i = j + needle.length;
    if (count > 2) return count;
  }
}

/** Apply a minimal unified diff (@@ hunks, context/+/− lines). Throws ToolError on mismatch. */
export function applyUnifiedPatch(original: string, patch: string): string {
  if (!patch.trim()) throw new ToolError("BAD_INPUT", "patch is empty");
  const origLines = original.split("\n");
  const out: string[] = [];
  let origCursor = 0; // 0-based
  const lines = patch.split("\n");
  let i = 0;
  let appliedAny = false;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const hunk = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (!hunk) {
      i++;
      continue; // skip ---/+++/index headers
    }
    appliedAny = true;
    const oldStart = Math.max(1, parseInt(hunk[1] ?? "1", 10));
    // copy through to hunk start
    while (origCursor < oldStart - 1) {
      if (origCursor >= origLines.length)
        throw new ToolError("CONFLICT", "patch hunk starts beyond end of file");
      out.push(origLines[origCursor] ?? "");
      origCursor++;
    }
    i++;
    while (i < lines.length && !(lines[i] ?? "").startsWith("@@")) {
      const l = lines[i] ?? "";
      if (l.startsWith("---") || l.startsWith("+++")) {
        i++;
        continue;
      }
      const marker = l[0];
      const body = l.slice(1);
      if (marker === " ") {
        if ((origLines[origCursor] ?? "") !== body)
          throw new ToolError("CONFLICT", `patch context mismatch at line ${origCursor + 1}`);
        out.push(body);
        origCursor++;
      } else if (marker === "-") {
        if ((origLines[origCursor] ?? "") !== body)
          throw new ToolError("CONFLICT", `patch removal mismatch at line ${origCursor + 1}`);
        origCursor++;
      } else if (marker === "+") {
        out.push(body);
      } else if (marker === "\\") {
        // "\ No newline at end of file" — ignore
      } else if (l === "") {
        // tolerate trailing newline
      } else {
        throw new ToolError("BAD_INPUT", `malformed patch line: ${l.slice(0, 60)}`);
      }
      i++;
    }
  }
  if (!appliedAny) throw new ToolError("BAD_INPUT", "patch contains no @@ hunks");
  while (origCursor < origLines.length) {
    out.push(origLines[origCursor] ?? "");
    origCursor++;
  }
  return out.join("\n");
}

function applyOpToContent(current: string | null, exists: boolean, op: EditOp): string | null {
  switch (op.op) {
    case "create":
      if (exists) throw new ToolError("CONFLICT", `${op.file} already exists`);
      if (op.content === undefined) throw new ToolError("BAD_INPUT", "create requires content");
      return op.content;
    case "replace":
      if (!exists || current === null) throw new ToolError("NOT_FOUND", `${op.file} does not exist`);
      if (op.content === undefined) throw new ToolError("BAD_INPUT", "replace requires content");
      if (op.old_string !== undefined) {
        const n = countOccurrences(current, op.old_string);
        if (n === 0) throw new ToolError("NOT_FOUND", `old_string not found in ${op.file}`);
        if (n > 1)
          throw new ToolError(
            "CONFLICT",
            `old_string matches ${n} times in ${op.file}; must match exactly once`,
          );
        return current.replace(op.old_string, op.new_string ?? "");
      }
      return op.content;
    case "patch":
      if (!exists || current === null) throw new ToolError("NOT_FOUND", `${op.file} does not exist`);
      if (!op.patch) throw new ToolError("BAD_INPUT", "patch op requires patch text");
      return applyUnifiedPatch(current, op.patch);
    case "delete":
      if (!exists) throw new ToolError("NOT_FOUND", `${op.file} does not exist`);
      return null;
  }
}

export async function batchEdit(fs: FileSystem, input: BatchEditInput): Promise<BatchEditResult> {
  const atomic = input.atomic ?? true;
  if (!Array.isArray(input.edits) || input.edits.length === 0)
    throw new ToolError("BAD_INPUT", "edits must be a non-empty array");
  if (input.edits.length > 100) throw new ToolError("BAD_INPUT", "too many edits (max 100)");
  for (const e of input.edits) assertSafePath(e.file);

  // stage: read all current contents first
  const current = new Map<string, string | null>();
  const existsMap = new Map<string, boolean>();
  for (const e of input.edits) {
    if (!current.has(e.file)) {
      const exists = await fs.exists(e.file).catch(() => false);
      existsMap.set(e.file, exists);
      current.set(e.file, exists ? await fs.readFile(e.file).catch(() => "") : null);
    }
  }
  const preimages: Record<string, string | null> = {};
  for (const [k, v] of current) preimages[k] = v;

  // validate + compute all new contents before touching disk
  const staged = new Map<string, string | null>();
  const errors = new Map<string, string>();
  // apply sequentially per file so multiple ops on same file compose
  const perFileOps = new Map<string, EditOp[]>();
  for (const e of input.edits) {
    const arr = perFileOps.get(e.file) ?? [];
    arr.push(e);
    perFileOps.set(e.file, arr);
  }
  for (const [file, ops] of perFileOps) {
    try {
      let cur = current.get(file) ?? null;
      let ex = existsMap.get(file) ?? false;
      for (const op of ops) {
        cur = applyOpToContent(cur, ex, op);
        ex = cur !== null;
      }
      staged.set(file, cur);
    } catch (err_) {
      const msg = err_ instanceof Error ? err_.message : String(err_);
      errors.set(file, msg);
      if (atomic) {
        const results: PerFileStatus[] = input.edits.map((e) => ({
          file: e.file,
          op: e.op,
          applied: false,
          error: errors.get(e.file) ?? msg,
        }));
        return { results, appliedAll: false, preimages };
      }
    }
  }

  const results: PerFileStatus[] = [];
  let allOk = true;
  for (const e of input.edits) {
    const fileErr = errors.get(e.file);
    if (fileErr) {
      results.push({ file: e.file, op: e.op, applied: false, error: fileErr });
      allOk = false;
      continue;
    }
  }
  // apply staged (only files without errors)
  for (const [file, next] of staged) {
    try {
      if (next === null) await fs.delete(file);
      else await fs.writeFile(file, next);
      for (const e of input.edits.filter((x) => x.file === file)) {
        results.push({ file, op: e.op, applied: true });
      }
    } catch (err_) {
      const msg = err_ instanceof Error ? err_.message : String(err_);
      allOk = false;
      for (const e of input.edits.filter((x) => x.file === file)) {
        results.push({ file, op: e.op, applied: false, error: msg });
      }
      if (atomic) {
        // best-effort rollback of what we already wrote in this call
        for (const [f, prev] of Object.entries(preimages)) {
          try {
            if (prev === null) await fs.delete(f).catch(() => undefined);
            else await fs.writeFile(f, prev).catch(() => undefined);
          } catch {
            // rollback is best-effort
          }
        }
        return { results: results.map((r) => ({ ...r, applied: false })), appliedAll: false, preimages };
      }
    }
  }
  return { results, appliedAll: allOk && errors.size === 0, preimages };
}
