import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PREFS, PREFS_VERSION, loadPrefs, migrateLegacyPrefs, uiStore } from "./ui.store";

describe("loadPrefs", () => {
  it("returns defaults for empty input", () => {
    expect(loadPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(loadPrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(loadPrefs("")).toEqual(DEFAULT_PREFS);
  });

  it("returns defaults for corrupt JSON or non-objects", () => {
    expect(loadPrefs("{nope}")).toEqual(DEFAULT_PREFS);
    expect(loadPrefs("42")).toEqual(DEFAULT_PREFS);
    expect(loadPrefs('"str"')).toEqual(DEFAULT_PREFS);
  });

  it("defaults to hands-off autonomy", () => {
    expect(DEFAULT_PREFS.approvalMode).toBe("autonomous");
    expect(DEFAULT_PREFS.confirmBash).toBe(false);
    expect(DEFAULT_PREFS.confirmWrite).toBe(false);
    expect(DEFAULT_PREFS.confirmNetwork).toBe(false);
  });

  it("accepts a fully valid payload", () => {
    expect(
      loadPrefs(
        JSON.stringify({
          approvalMode: "read-only",
          compressionThreshold: 72,
          confirmBash: true,
          confirmWrite: false,
          confirmNetwork: false,
          effort: "High",
          memoryEnabled: false,
          memoryBudgetTokens: 500,
          includeSensitiveMemory: true,
          memoryAutoSave: false,
          prefsVersion: 1,
        }),
      ),
    ).toEqual({
      approvalMode: "read-only",
      compressionThreshold: 72,
      confirmBash: true,
      confirmWrite: false,
      confirmNetwork: false,
      effort: "High",
      memoryEnabled: false,
      memoryBudgetTokens: 500,
      includeSensitiveMemory: true,
      memoryAutoSave: false,
      prefsVersion: 1,
    });
  });

  it("marks stored payloads without a version as legacy", () => {
    expect(loadPrefs(JSON.stringify({})).prefsVersion).toBe(0);
  });

  it("ignores removed pre-redesign keys", () => {
    const p = loadPrefs(
      JSON.stringify({
        daemonAutoConnect: false,
        daemonHost: "0.0.0.0",
        tokenBudget: "128000",
        fallbackModel: "openai/gpt-4o",
      }),
    );
    expect("daemonHost" in p).toBe(false);
    expect("tokenBudget" in p).toBe(false);
    expect("fallbackModel" in p).toBe(false);
  });

  it("falls back per-field for unknown values", () => {
    expect(loadPrefs(JSON.stringify({ approvalMode: "yolo", effort: "Extreme", extra: 1 }))).toEqual({
      ...DEFAULT_PREFS,
      prefsVersion: 0,
    });
  });

  it("clamps the compression threshold into 50..95", () => {
    expect(loadPrefs(JSON.stringify({ compressionThreshold: 10 })).compressionThreshold).toBe(50);
    expect(loadPrefs(JSON.stringify({ compressionThreshold: 99 })).compressionThreshold).toBe(95);
    expect(loadPrefs(JSON.stringify({ compressionThreshold: 72.4 })).compressionThreshold).toBe(72);
    expect(loadPrefs(JSON.stringify({ compressionThreshold: "85" })).compressionThreshold).toBe(
      DEFAULT_PREFS.compressionThreshold,
    );
  });

  it("defaults memory prefs when absent and clamps the budget", () => {
    const p = loadPrefs(JSON.stringify({}));
    expect(p.memoryEnabled).toBe(true);
    expect(p.memoryBudgetTokens).toBe(800);
    expect(p.includeSensitiveMemory).toBe(false);
    expect(p.memoryAutoSave).toBe(true);
    expect(loadPrefs(JSON.stringify({ memoryBudgetTokens: 50 })).memoryBudgetTokens).toBe(200);
    expect(loadPrefs(JSON.stringify({ memoryBudgetTokens: 99999 })).memoryBudgetTokens).toBe(2048);
  });
});

describe("migrateLegacyPrefs", () => {
  it("migrates pre-redesign stores to hands-off autonomy once", () => {
    const migrated = migrateLegacyPrefs({
      ...DEFAULT_PREFS,
      approvalMode: "always-ask",
      confirmBash: true,
      prefsVersion: 0,
    });
    expect(migrated.approvalMode).toBe("autonomous");
    expect(migrated.confirmBash).toBe(false);
    expect(migrated.confirmWrite).toBe(false);
    expect(migrated.confirmNetwork).toBe(false);
    expect(migrated.prefsVersion).toBe(PREFS_VERSION);
  });

  it("leaves migrated stores untouched, even on always-ask", () => {
    const current = { ...DEFAULT_PREFS, approvalMode: "always-ask" as const };
    expect(migrateLegacyPrefs(current)).toBe(current);
  });
});

describe("uiStore prefs", () => {
  beforeEach(() => {
    window.localStorage.clear();
    uiStore.resetPrefs();
  });

  it("merges patches and persists them", () => {
    uiStore.setPrefs({ effort: "High", compressionThreshold: 60 });
    expect(uiStore.state.prefs.effort).toBe("High");
    expect(uiStore.state.prefs.compressionThreshold).toBe(60);
    expect(uiStore.state.prefs.approvalMode).toBe(DEFAULT_PREFS.approvalMode);
    const stored = JSON.parse(window.localStorage.getItem("rudra.prefs") ?? "{}");
    expect(stored.effort).toBe("High");
  });

  it("resets to defaults and clears storage", () => {
    uiStore.setPrefs({ effort: "Medium" });
    uiStore.resetPrefs();
    expect(uiStore.state.prefs).toEqual(DEFAULT_PREFS);
    expect(window.localStorage.getItem("rudra.prefs")).toBeNull();
  });
});
