import { beforeEach, describe, expect, it } from "vitest";
import {
  formatSelection,
  getModelSelection,
  setModelSelection,
  toModelOptions,
} from "./models";
import type { Provider } from "../backend/types";

function provider(id: string, name: string, models: Record<string, { name?: string }>): Provider {
  return { id, name, source: "config", env: [], options: {}, models } as unknown as Provider;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("toModelOptions", () => {
  it("flattens provider model maps into sorted options", () => {
    const options = toModelOptions([
      provider("anthropic", "Anthropic", { "claude-x": { name: "Claude X" } }),
      provider("unorouter", "UnoRouter", { "model-b": {}, "model-a": { name: "A" } }),
    ]);
    expect(options.map((o) => o.value)).toEqual([
      "anthropic/claude-x",
      "unorouter/model-a",
      "unorouter/model-b",
    ]);
    expect(options[0]).toMatchObject({
      providerID: "anthropic",
      modelID: "claude-x",
      label: "Anthropic · Claude X",
    });
    // Falls back to IDs when names are missing.
    expect(options[2]).toMatchObject({ modelName: "model-b", label: "UnoRouter · model-b" });
  });

  it("returns an empty list when providers are missing", () => {
    expect(toModelOptions([])).toEqual([]);
    expect(toModelOptions(undefined as unknown as Provider[])).toEqual([]);
  });
});

describe("model persistence", () => {
  it("round-trips the selection through localStorage", () => {
    expect(getModelSelection()).toBeUndefined();
    setModelSelection({ providerID: "anthropic", modelID: "claude-x" });
    expect(getModelSelection()).toEqual({ providerID: "anthropic", modelID: "claude-x" });
    expect(formatSelection(getModelSelection())).toBe("anthropic/claude-x");
    setModelSelection(undefined);
    expect(getModelSelection()).toBeUndefined();
    expect(formatSelection(undefined)).toBe("");
  });

  it("ignores malformed stored values", () => {
    window.localStorage.setItem("rudra.model", "no-slash-here");
    expect(getModelSelection()).toBeUndefined();
    window.localStorage.setItem("rudra.model", "/leading");
    expect(getModelSelection()).toBeUndefined();
  });
});
