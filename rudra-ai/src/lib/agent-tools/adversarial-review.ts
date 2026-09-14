/** adversarial_review: second-model critique with no access to author reasoning. */
import { ToolError, clamp } from "./types";

export type FindingSeverity = "error" | "warning" | "info";

export interface ReviewFinding {
  severity: FindingSeverity;
  file: string;
  line: number;
  category: string;
  message: string;
  suggested_fix?: string;
}

export interface AdversarialInput {
  diff?: string;
  checklist?: string[];
  reviewer_model?: string;
  max_findings?: number;
  getUnstagedDiff?: () => Promise<string>;
}

export interface ReviewResult {
  findings: ReviewFinding[];
  reviewedChars: number;
  model: string;
}

export type ReviewerFn = (args: {
  diff: string;
  checklist: string[];
  model: string;
}) => Promise<unknown>;

const SEV_RANK: Record<FindingSeverity, number> = { error: 0, warning: 1, info: 2 };

function coerceFindings(raw: unknown, max: number): ReviewFinding[] {
  if (!Array.isArray(raw)) return [];
  const out: ReviewFinding[] = [];
  for (const f of raw as Array<Record<string, unknown>>) {
    const sev = f["severity"];
    if (sev !== "error" && sev !== "warning" && sev !== "info") continue;
    const file = String(f["file"] ?? "unknown");
    const line = typeof f["line"] === "number" && f["line"] >= 1 ? Math.floor(f["line"]) : 1;
    const category = String(f["category"] ?? "general").slice(0, 40);
    const message = String(f["message"] ?? "").slice(0, 800);
    if (!message) continue;
    const suggested =
      typeof f["suggested_fix"] === "string" ? f["suggested_fix"].slice(0, 800) : undefined;
    out.push({ severity: sev, file, line, category, message, suggested_fix: suggested });
    if (out.length >= max) break;
  }
  return out.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.file.localeCompare(b.file));
}

export async function adversarialReview(
  reviewer: ReviewerFn | undefined,
  input: AdversarialInput,
): Promise<ReviewResult> {
  const max = clamp(Math.round(input.max_findings ?? 10), 1, 50);
  let diff = (input.diff ?? "").trim();
  if (!diff && input.getUnstagedDiff) {
    try {
      diff = (await input.getUnstagedDiff()).trim();
    } catch {
      diff = "";
    }
  }
  if (!diff) return { findings: [], reviewedChars: 0, model: input.reviewer_model ?? "default-reviewer" };
  if (diff.length > 200_000) throw new ToolError("BAD_INPUT", "diff too large (max ~200k chars)");
  const checklist =
    input.checklist?.filter((c) => c.trim()).slice(0, 20) ?? ["security", "correctness", "error-handling"];
  const model = input.reviewer_model?.trim() || "default-reviewer";
  if (!reviewer) throw new ToolError("TOOL_UNAVAILABLE", "no reviewer model configured");
  let raw: unknown;
  try {
    // NOTE: only diff + checklist cross the boundary — never author scratchpad/reasoning.
    raw = await reviewer({ diff, checklist, model });
  } catch (e) {
    throw new ToolError("EXEC_FAILED", `reviewer failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { findings: coerceFindings(raw, max), reviewedChars: diff.length, model };
}
