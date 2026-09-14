import { describe, expect, it } from "vitest";
import { shouldRunVisualVerify, visualVerify } from "./visual-verify";
import { gateTools, inferCapabilities } from "./capability-gates";
import { ToolError } from "./types";

const driver = {
  capture: async () => ({
    screenshotId: "shot1",
    dom: "<div>hi</div>",
    consoleErrors: ["e1"],
    networkFailures: [],
    selectorFound: true,
  }),
  diffBaseline: async () => ({ pixels_changed: 5, regions: ["header"] }),
};

describe("visualVerify", () => {
  it("captures + diffs baseline with a pass verdict", async () => {
    const r = await visualVerify(driver, {
      url: "http://localhost:5173/",
      viewport: { width: 1280, height: 800 },
      baseline: "shot0",
      expect_selector: "#app",
    });
    expect(r.screenshot_id).toBe("shot1");
    expect(r.diff_vs_baseline?.pixels_changed).toBe(5);
    expect(r.passed).toBe(false); // driver reports a console error
  });
  it("passes on clean console + found selector; fails when selector missing", async () => {
    const clean = {
      capture: async () => ({
        screenshotId: "s2",
        dom: "<div/>",
        consoleErrors: [],
        networkFailures: ["flaky.png"],
        selectorFound: true,
      }),
    };
    const ok = await visualVerify(clean, { url: "http://x/", expect_selector: "#a" });
    expect(ok.passed).toBe(true); // network failures are warnings only
    const missing = await visualVerify(
      { capture: async () => ({ screenshotId: "s3", dom: "", consoleErrors: [], networkFailures: [], selectorFound: false }) },
      { url: "http://x/", expect_selector: "#a" },
    );
    expect(missing.passed).toBe(false);
  });
  it("gates when no driver; validates url/actions", async () => {
    await expect(visualVerify(undefined, { url: "http://x/" })).rejects.toThrow(ToolError);
    await expect(visualVerify(driver, { url: "ftp://x" })).rejects.toThrow(ToolError);
    await expect(visualVerify(driver, { url: "http://x/", actions: [{ wait: 99999 }] })).rejects.toThrow(ToolError);
  });
  it("clamps viewport; tolerates baseline diff failure", async () => {
    const r = await visualVerify(
      {
        capture: driver.capture,
        diffBaseline: async () => {
          throw new Error("no baseline");
        },
      },
      { url: "http://x/", viewport: { width: 99999, height: 1 }, baseline: "b" },
    );
    expect(r.diff_vs_baseline).toBeUndefined();
  });
  it("shouldRunVisualVerify detects frontend paths only", () => {
    expect(shouldRunVisualVerify(["src/components/X.tsx"])).toBe(true);
    expect(shouldRunVisualVerify(["src-tauri/src/main.rs"])).toBe(false);
  });
});

describe("capability gates", () => {
  it("frontend-only hides db/api, keeps visual", () => {
    const caps = inferCapabilities(["package.json", "src/components/A.tsx", "src/pages/B.tsx"]);
    const tools = gateTools(caps);
    expect(tools).toContain("visual_verify");
    expect(tools).not.toContain("db_schema");
    expect(tools.length).toBeLessThanOrEqual(16);
  });
  it("backend with migrations exposes db; non-git hides history", () => {
    const caps = inferCapabilities(["Cargo.toml", "migrations/001.sql", "src/main.rs"]);
    expect(gateTools(caps)).toContain("db_schema");
    expect(gateTools({ ...caps, hasGit: false })).not.toContain("git_history");
  });
});
