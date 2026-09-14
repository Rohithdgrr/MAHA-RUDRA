/** visual_verify: screenshot + DOM diff for frontend. Gated; driver injected. */
import { ToolError, clamp } from "./types";

export interface Viewport {
  width: number;
  height: number;
}

export type VisualAction =
  | { click: string }
  | { type: string; text: string }
  | { wait: number }
  | { scroll: number };

export interface VisualInput {
  url: string;
  viewport?: Viewport;
  actions?: VisualAction[];
  baseline?: string;
  expect_selector?: string;
}

export interface VisualResult {
  /** Boolean verdict: selector (when asserted) found AND zero console errors.
   *  Network failures are warnings only — they don't fail the check. */
  passed: boolean;
  screenshot_id: string;
  dom_snapshot: string;
  console_errors: string[];
  network_failures: string[];
  selectorFound?: boolean;
  diff_vs_baseline?: { pixels_changed: number; regions: string[] };
}

export interface BrowserDriver {
  capture(input: {
    url: string;
    viewport: Viewport;
    actions: VisualAction[];
    expectSelector?: string;
  }): Promise<{
    screenshotId: string;
    dom: string;
    consoleErrors: string[];
    networkFailures: string[];
    selectorFound?: boolean;
  }>;
  diffBaseline?(baseline: string, current: string): Promise<{ pixels_changed: number; regions: string[] }>;
}

const FRONTEND_RE = /\.(tsx|jsx|css|scss|vue)$|src\/(components|pages|styles)\//;

export function shouldRunVisualVerify(changedFiles: string[]): boolean {
  return changedFiles.some((f) => FRONTEND_RE.test(f.replace(/\\/g, "/")));
}

function validateActions(actions: VisualAction[]): void {
  if (actions.length > 20) throw new ToolError("BAD_INPUT", "too many actions (max 20)");
  for (const a of actions) {
    if ("wait" in a && (!Number.isFinite(a.wait) || a.wait < 0 || a.wait > 30000))
      throw new ToolError("BAD_INPUT", "wait must be 0..30000ms");
    if ("scroll" in a && !Number.isFinite(a.scroll))
      throw new ToolError("BAD_INPUT", "scroll must be finite");
    if ("click" in a && !a.click.trim()) throw new ToolError("BAD_INPUT", "click selector empty");
    if ("type" in a && (!a.type.trim() || (a.text ?? "").length > 5000))
      throw new ToolError("BAD_INPUT", "invalid type action");
  }
}

export async function visualVerify(
  driver: BrowserDriver | undefined,
  input: VisualInput,
): Promise<VisualResult> {
  if (!driver) throw new ToolError("TOOL_UNAVAILABLE", "visual verification is gated (frontend sessions only)");
  if (!/^https?:\/\//i.test((input.url ?? "").trim()))
    throw new ToolError("BAD_INPUT", "url must be an http(s) dev-server route");
  const viewport: Viewport = {
    width: clamp(Math.round(input.viewport?.width ?? 1280), 320, 3840),
    height: clamp(Math.round(input.viewport?.height ?? 800), 240, 2160),
  };
  const actions = input.actions ?? [];
  validateActions(actions);
  let cap: Awaited<ReturnType<BrowserDriver["capture"]>>;
  try {
    cap = await driver.capture({ url: input.url, viewport, actions, expectSelector: input.expect_selector });
  } catch (e) {
    throw new ToolError("EXEC_FAILED", `browser capture failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  let diff_vs_baseline: VisualResult["diff_vs_baseline"];
  if (input.baseline && driver.diffBaseline) {
    try {
      diff_vs_baseline = await driver.diffBaseline(input.baseline, cap.screenshotId);
    } catch {
      diff_vs_baseline = undefined; // baseline diff is best-effort
    }
  }
  const consoleErrors = cap.consoleErrors.slice(0, 50);
  const selectorOk = input.expect_selector ? cap.selectorFound === true : true;
  return {
    passed: selectorOk && consoleErrors.length === 0,
    screenshot_id: cap.screenshotId,
    dom_snapshot: cap.dom.slice(0, 50_000),
    console_errors: consoleErrors,
    network_failures: cap.networkFailures.slice(0, 50),
    selectorFound: cap.selectorFound,
    diff_vs_baseline,
  };
}
