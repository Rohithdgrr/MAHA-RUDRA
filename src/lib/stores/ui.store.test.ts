import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PREFS, loadPrefs, uiStore } from "./ui.store";

describe("loadPrefs", () => {
  it("returns defaults for empty input", () => {
    expect(loadPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(loadPrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(loadPrefs("")).toEqual(DEFAULT_PREFS);
  });

  it("returns defaults for corrupt JSON or non-objects", () => {
    expect(loadPrefs("{nope")).toEqual(DEFAULT_PREFS);
    expect(loadPrefs("42")).toEqual(DEFAULT_PREFS);
    expect(loadPrefs('"str"')).toEqual(DEFAULT_PREFS);
  });

  it("accepts a fully valid payload", () => {
    expect(
      loadPrefs(
        JSON.stringify({
          approvalMode: "autonomous",
          compressionThreshold: 72,
          daemonAutoConnect: false,
          telemetryAlertAt: "5.50",
          effort: "High",
        }),
      ),
    ).toEqual({
      approvalMode: "autonomous",
      compressionThreshold: 72,
      daemonAutoConnect: false,
      telemetryAlertAt: "5.50",
      effort: "High",
    });
  });

  it("falls back per-field for unknown values", () => {
    expect(
      loadPrefs(JSON.stringify({ approvalMode: "yolo", effort: "Extreme", extra: 1 })),
    ).toEqual(DEFAULT_PREFS);
  });

  it("clamps the compression threshold into 50..95", () => {
    expect(loadPrefs(JSON.stringify({ compressionThreshold: 10 })).compressionThreshold).toBe(50);
    expect(loadPrefs(JSON.stringify({ compressionThreshold: 99 })).compressionThreshold).toBe(95);
    expect(loadPrefs(JSON.stringify({ compressionThreshold: 72.4 })).compressionThreshold).toBe(72);
    expect(loadPrefs(JSON.stringify({ compressionThreshold: "85" })).compressionThreshold).toBe(
      DEFAULT_PREFS.compressionThreshold,
    );
  });

  it("rejects blank alert values and non-boolean daemon flags", () => {
    const prefs = loadPrefs(
      JSON.stringify({ telemetryAlertAt: "   ", daemonAutoConnect: "yes" }),
    );
    expect(prefs.telemetryAlertAt).toBe(DEFAULT_PREFS.telemetryAlertAt);
    expect(prefs.daemonAutoConnect).toBe(DEFAULT_PREFS.daemonAutoConnect);
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
